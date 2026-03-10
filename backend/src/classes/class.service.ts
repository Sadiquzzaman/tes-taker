import { BadRequestException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, ILike, MoreThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ClassEntity } from './entities/class.entity';
import { ClassStudentEntity, ClassStudentStatusEnum } from './entities/class-student.entity';
import { UserEntity } from 'src/user/entities/user.entity';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { RolesEnum } from 'src/common/enums/roles.enum';
import { EmailService } from 'src/email/email.service';
import { SmsService } from 'src/sms/sms.service';
import { StudentExamSubmissionEntity, ExamSubmissionStatusEnum } from 'src/exams/entities/student-exam-answer.entity';
import { ExamEntity } from 'src/exams/entities/exam.entity';
import { randomUUID } from 'crypto';

@Injectable()
export class ClassService {
  constructor(
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
    @InjectRepository(ClassStudentEntity)
    private readonly classStudentRepo: Repository<ClassStudentEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(StudentExamSubmissionEntity)
    private readonly submissionRepo: Repository<StudentExamSubmissionEntity>,
    @InjectRepository(ExamEntity)
    private readonly examRepo: Repository<ExamEntity>,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Create a new class
   */
  async create(dto: CreateClassDto, jwtPayload: JwtPayloadInterface): Promise<ClassEntity> {
    const classEntity = this.classRepo.create({
      class_name: dto.class_name,
      description: dto.description,
      teacher_id: jwtPayload.id,
      created_by: jwtPayload.id,
      created_user_name: jwtPayload.full_name,
      created_at: new Date(),
    });

    const savedClass = await this.classRepo.save(classEntity);

    // Add students if provided (using old method for backward compatibility)
    if (dto.student_ids && dto.student_ids.length > 0) {
      await this.addStudentsToClass(savedClass.id, dto.student_ids, jwtPayload);
    }

    return this.findOne(savedClass.id, jwtPayload);
  }

  /**
   * Find all classes for a teacher
   */
  async findAll(jwtPayload: JwtPayloadInterface): Promise<ClassEntity[]> {
    const classes = await this.classRepo.find({
      where: { teacher_id: jwtPayload.id },
      relations: ['classStudents', 'classStudents.student', 'teacher'],
      order: { created_at: 'DESC' },
    });

    // Add test statistics
    for (const classEntity of classes) {
      await this.addTestStatistics(classEntity);
    }

    return classes;
  }

  /**
   * Find a class by ID
   */
  async findOne(id: string, jwtPayload: JwtPayloadInterface): Promise<ClassEntity> {
    const classEntity = await this.classRepo.findOne({
      where: { id },
      relations: ['classStudents', 'classStudents.student', 'teacher'],
    });

    if (!classEntity) {
      throw new NotFoundException('Class not found');
    }

    // Check if teacher owns the class or is admin
    if (
      classEntity.teacher_id !== jwtPayload.id &&
      jwtPayload.role !== RolesEnum.ADMIN &&
      jwtPayload.role !== RolesEnum.SUPER_ADMIN
    ) {
      throw new ForbiddenException('You do not have permission to access this class');
    }

    // Add test statistics
    await this.addTestStatistics(classEntity);

    return classEntity;
  }

  /**
   * Add test statistics to class entity
   */
  private async addTestStatistics(classEntity: ClassEntity): Promise<void> {
    // Get all exams for this class
    const exams = await this.examRepo.find({
      where: { class_id: classEntity.id },
      select: ['id'],
    });

    if (exams.length === 0) {
      classEntity.total_test_taken = 0;
      classEntity.last_test_taken_date = null;
      return;
    }

    const examIds = exams.map(e => e.id);

    // Get all submissions for these exams
    const submissions = await this.submissionRepo.find({
      where: {
        exam_id: In(examIds),
        status: In([ExamSubmissionStatusEnum.SUBMITTED, ExamSubmissionStatusEnum.AUTO_SUBMITTED]),
      },
      select: ['submitted_at'],
      order: { submitted_at: 'DESC' },
    });

    classEntity.total_test_taken = submissions.length;
    classEntity.last_test_taken_date = submissions.length > 0 ? submissions[0].submitted_at : null;
  }

  /**
   * Update a class
   */
  async update(
    id: string,
    dto: UpdateClassDto,
    jwtPayload: JwtPayloadInterface,
  ): Promise<ClassEntity> {
    const classEntity = await this.findOne(id, jwtPayload);

    if (dto.class_name) classEntity.class_name = dto.class_name;
    if (dto.description !== undefined) classEntity.description = dto.description;

    classEntity.updated_by = jwtPayload.id;
    classEntity.updated_user_name = jwtPayload.full_name;
    classEntity.updated_at = new Date();

    await this.classRepo.save(classEntity);

    return this.findOne(id, jwtPayload);
  }

  /**
   * Delete a class
   */
  async delete(id: string, jwtPayload: JwtPayloadInterface): Promise<void> {
    const classEntity = await this.findOne(id, jwtPayload);
    await this.classRepo.remove(classEntity);
  }

  /**
   * Add students to a class by IDs (backward compatibility)
   */
  async addStudentsToClass(
    classId: string,
    studentIds: string[],
    jwtPayload: JwtPayloadInterface,
  ): Promise<ClassEntity> {
    const classEntity = await this.findOne(classId, jwtPayload);

    const students = await this.userRepo.find({
      where: { id: In(studentIds), role: RolesEnum.STUDENT },
    });

    if (students.length !== studentIds.length) {
      const foundIds = students.map((s) => s.id);
      const missingIds = studentIds.filter((id) => !foundIds.includes(id));
      throw new BadRequestException(
        `Some students not found or are not students: ${missingIds.join(', ')}`,
      );
    }

    // Get existing student IDs in class
    const existingClassStudents = await this.classStudentRepo.find({
      where: { class_id: classId },
      select: ['student_id'],
    });
    const existingStudentIds = existingClassStudents
      .map(cs => cs.student_id)
      .filter(id => id !== null) as string[];

    // Filter out duplicates
    const newStudents = students.filter((s) => !existingStudentIds.includes(s.id));

    if (newStudents.length === 0) {
      throw new BadRequestException('All provided students are already in this class');
    }

    // Create ClassStudentEntity records with status JOINED
    const classStudentEntities = newStudents.map(student =>
      this.classStudentRepo.create({
        class_id: classId,
        student_id: student.id,
        status: ClassStudentStatusEnum.JOINED,
        joined_at: new Date(),
        approved_at: new Date(),
        approved_by: jwtPayload.id,
      })
    );

    await this.classStudentRepo.save(classStudentEntities);

    return this.findOne(classId, jwtPayload);
  }

  /**
   * Add students by phone or email (bulk)
   */
  async addStudentsByPhoneOrEmail(
    classId: string,
    contacts: string[],
    jwtPayload: JwtPayloadInterface,
  ): Promise<{
    added: number;
    invited: number;
    pending: number;
    errors: string[];
  }> {
    const classEntity = await this.findOne(classId, jwtPayload);
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');

    let added = 0;
    let invited = 0;
    let pending = 0;
    const errors: string[] = [];

    // Get existing class students
    const existingClassStudents = await this.classStudentRepo.find({
      where: { class_id: classId },
    });

    const existingStudentIds = existingClassStudents
      .map(cs => cs.student_id)
      .filter(id => id !== null) as string[];
    const existingInvitedEmails = existingClassStudents
      .map(cs => cs.invited_email)
      .filter(email => email !== null) as string[];
    const existingInvitedPhones = existingClassStudents
      .map(cs => cs.invited_phone)
      .filter(phone => phone !== null) as string[];

    for (const contact of contacts) {
      const trimmedContact = contact.trim();
      if (!trimmedContact) continue;

      const isEmail = trimmedContact.includes('@');
      const isPhone = /^01[3-9]\d{8}$/.test(trimmedContact);

      if (!isEmail && !isPhone) {
        errors.push(`Invalid contact format: ${trimmedContact}`);
        continue;
      }

      try {
        if (isEmail) {
          // Check if already invited
          if (existingInvitedEmails.includes(trimmedContact.toLowerCase())) {
            continue;
          }

          // Find student by email
          const student = await this.userRepo.findOne({
            where: { email: trimmedContact.toLowerCase() },
          });

          if (student) {
            if (student.role !== RolesEnum.STUDENT) {
              errors.push(`${trimmedContact} is not a student`);
              continue;
            }

            // Check if already in class
            if (existingStudentIds.includes(student.id)) {
              continue;
            }

            // Add student with appropriate status
            if (student.is_otp_verified && student.is_verified) {
              // Directly joined
              await this.classStudentRepo.save(
                this.classStudentRepo.create({
                  class_id: classId,
                  student_id: student.id,
                  status: ClassStudentStatusEnum.JOINED,
                  joined_at: new Date(),
                  approved_at: new Date(),
                  approved_by: jwtPayload.id,
                })
              );
              added++;
            } else {
              // Pending approval
              await this.classStudentRepo.save(
                this.classStudentRepo.create({
                  class_id: classId,
                  student_id: student.id,
                  status: ClassStudentStatusEnum.PENDING,
                  joined_at: new Date(),
                })
              );
              pending++;
            }
          } else {
            // Not onboarded - send invitation
            const invitationToken = randomUUID();
            const invitationLink = `${frontendUrl}/register:${classId}`;

            await this.classStudentRepo.save(
              this.classStudentRepo.create({
                class_id: classId,
                student_id: null,
                status: ClassStudentStatusEnum.INVITED,
                invited_email: trimmedContact.toLowerCase(),
                invitation_token: invitationToken,
                invited_at: new Date(),
              })
            );

            // Send email invitation
            try {
              await this.emailService.sendInvitationEmail(
                trimmedContact.toLowerCase(),
                invitationLink,
                classEntity.class_name,
                jwtPayload.full_name,
              );
              invited++;
            } catch (error) {
              errors.push(`Failed to send email to ${trimmedContact}: ${error.message}`);
            }
          }
        } else if (isPhone) {
          // Check if already invited
          if (existingInvitedPhones.includes(trimmedContact)) {
            continue;
          }

          // Find student by phone
          const student = await this.userRepo.findOne({
            where: { phone: trimmedContact },
          });

          if (student) {
            if (student.role !== RolesEnum.STUDENT) {
              errors.push(`${trimmedContact} is not a student`);
              continue;
            }

            // Check if already in class
            if (existingStudentIds.includes(student.id)) {
              continue;
            }

            // Add student with appropriate status
            if (student.is_otp_verified && student.is_verified) {
              // Directly joined
              await this.classStudentRepo.save(
                this.classStudentRepo.create({
                  class_id: classId,
                  student_id: student.id,
                  status: ClassStudentStatusEnum.JOINED,
                  joined_at: new Date(),
                  approved_at: new Date(),
                  approved_by: jwtPayload.id,
                })
              );
              added++;
            } else {
              // Pending approval
              await this.classStudentRepo.save(
                this.classStudentRepo.create({
                  class_id: classId,
                  student_id: student.id,
                  status: ClassStudentStatusEnum.PENDING,
                  joined_at: new Date(),
                })
              );
              pending++;
            }
          } else {
            // Not onboarded - send invitation
            const invitationToken = randomUUID();
            const invitationLink = `${frontendUrl}/register:${classId}`;

            await this.classStudentRepo.save(
              this.classStudentRepo.create({
                class_id: classId,
                student_id: null,
                status: ClassStudentStatusEnum.INVITED,
                invited_phone: trimmedContact,
                invitation_token: invitationToken,
                invited_at: new Date(),
              })
            );

            // Send SMS invitation
            try {
              const smsMessage = `You've been invited to join ${classEntity.class_name} on TestTaker. Register here: ${invitationLink}`;
              const smsSent = await this.smsService.sendSms(trimmedContact, smsMessage);
              if (smsSent) {
                invited++;
              } else {
                errors.push(`Failed to send SMS to ${trimmedContact}`);
              }
            } catch (error) {
              errors.push(`Failed to send SMS to ${trimmedContact}: ${error.message}`);
            }
          }
        }
      } catch (error) {
        errors.push(`Error processing ${trimmedContact}: ${error.message}`);
      }
    }

    return { added, invited, pending, errors };
  }

  /**
   * Approve a pending student
   */
  async approveStudent(
    classId: string,
    studentId: string,
    jwtPayload: JwtPayloadInterface,
  ): Promise<ClassStudentEntity> {
    await this.findOne(classId, jwtPayload); // Verify access

    const classStudent = await this.classStudentRepo.findOne({
      where: { class_id: classId, student_id: studentId },
    });

    if (!classStudent) {
      throw new NotFoundException('Student not found in this class');
    }

    if (classStudent.status !== ClassStudentStatusEnum.PENDING) {
      throw new BadRequestException(`Student status is ${classStudent.status}, cannot approve`);
    }

    classStudent.status = ClassStudentStatusEnum.JOINED;
    classStudent.approved_at = new Date();
    classStudent.approved_by = jwtPayload.id;

    return await this.classStudentRepo.save(classStudent);
  }

  /**
   * Generate share link for class
   */
  async generateShareLink(
    classId: string,
    jwtPayload: JwtPayloadInterface,
  ): Promise<string> {
    const classEntity = await this.findOne(classId, jwtPayload);
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');

    // Generate or reuse share token
    if (!classEntity.share_token) {
      classEntity.share_token = randomUUID();
      await this.classRepo.save(classEntity);
    }

    return `${frontendUrl}/classes/join/${classEntity.share_token}`;
  }

  /**
   * Join class by share token
   */
  async joinClassByShareToken(
    shareToken: string,
    studentId: string,
  ): Promise<ClassStudentEntity> {
    const classEntity = await this.classRepo.findOne({
      where: { share_token: shareToken },
    });

    if (!classEntity) {
      throw new NotFoundException('Invalid share link');
    }

    // Check if student is already in class
    const existing = await this.classStudentRepo.findOne({
      where: { class_id: classEntity.id, student_id: studentId },
    });

    if (existing) {
      throw new BadRequestException('You are already in this class');
    }

    // Verify student is onboarded
    const student = await this.userRepo.findOne({
      where: { id: studentId },
    });

    if (!student || !student.is_otp_verified || !student.is_verified) {
      throw new BadRequestException('You must complete registration and verification before joining a class');
    }

    if (student.role !== RolesEnum.STUDENT) {
      throw new BadRequestException('Only students can join classes');
    }

    // Add student with PENDING status (teacher needs to approve)
    const classStudent = this.classStudentRepo.create({
      class_id: classEntity.id,
      student_id: studentId,
      status: ClassStudentStatusEnum.PENDING,
      joined_at: new Date(),
    });

    return await this.classStudentRepo.save(classStudent);
  }

  /**
   * Handle class invitation during registration
   * Uses class UUID to find matching invitation by phone/email
   */
  async handleClassInvitation(
    classId: string,
    studentId: string,
    phone: string,
    email?: string,
  ): Promise<void> {
    // Find invitation record for this class matching phone or email
    const classStudent = await this.classStudentRepo.findOne({
      where: [
        { class_id: classId, invited_phone: phone, status: ClassStudentStatusEnum.INVITED },
        ...(email ? [{ class_id: classId, invited_email: email.toLowerCase(), status: ClassStudentStatusEnum.INVITED }] : []),
      ],
    });

    if (!classStudent) {
      // No invitation found, but that's okay - student can still register
      return;
    }

    if (classStudent.status !== ClassStudentStatusEnum.INVITED) {
      // Invitation already used, but that's okay
      return;
    }

    // Update class student record
    classStudent.student_id = studentId;
    classStudent.status = ClassStudentStatusEnum.PENDING;
    classStudent.joined_at = new Date();
    classStudent.invitation_token = null; // Clear token after use

    await this.classStudentRepo.save(classStudent);
  }

  /**
   * Remove students from a class
   */
  async removeStudentsFromClass(
    classId: string,
    studentIds: string[],
    jwtPayload: JwtPayloadInterface,
  ): Promise<ClassEntity> {
    await this.findOne(classId, jwtPayload);

    await this.classStudentRepo.delete({
      class_id: classId,
      student_id: In(studentIds),
    });

    return this.findOne(classId, jwtPayload);
  }

  /**
   * Search students by name, email, or phone
   */
  async searchStudents(query: string): Promise<UserEntity[]> {
    if (!query || query.length < 2) {
      return [];
    }

    const searchPattern = `%${query}%`;

    const students = await this.userRepo.find({
      where: [
        { full_name: ILike(searchPattern), role: RolesEnum.STUDENT },
        { email: ILike(searchPattern), role: RolesEnum.STUDENT },
        { phone: ILike(searchPattern), role: RolesEnum.STUDENT },
      ],
      select: ['id', 'full_name', 'email', 'phone'],
      take: 20,
    });

    return students;
  }

  /**
   * Get students in a class with status
   */
  async getClassStudents(classId: string, jwtPayload: JwtPayloadInterface): Promise<ClassStudentEntity[]> {
    await this.findOne(classId, jwtPayload);
    
    return await this.classStudentRepo.find({
      where: { class_id: classId },
      relations: ['student'],
      order: { created_at: 'DESC' },
    });
  }
}

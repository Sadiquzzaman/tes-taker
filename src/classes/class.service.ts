import { BadRequestException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Like, ILike } from 'typeorm';
import { ClassEntity } from './entities/class.entity';
import { UserEntity } from 'src/user/entities/user.entity';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { RolesEnum } from 'src/common/enums/roles.enum';

@Injectable()
export class ClassService {
  constructor(
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  /**
   * Create a new class
   */
  async create(dto: CreateClassDto, jwtPayload: JwtPayloadInterface): Promise<ClassEntity> {
    // Create the class
    const classEntity = this.classRepo.create({
      class_name: dto.class_name,
      description: dto.description,
      teacher_id: jwtPayload.id,
      created_by: jwtPayload.id,
      created_user_name: jwtPayload.full_name,
      created_at: new Date(),
    });

    // Save the class first
    const savedClass = await this.classRepo.save(classEntity);

    // Add students if provided
    if (dto.student_ids && dto.student_ids.length > 0) {
      await this.addStudentsToClass(savedClass.id, dto.student_ids, jwtPayload);
    }

    // Return with students relation
    return this.findOne(savedClass.id, jwtPayload);
  }

  /**
   * Find all classes for a teacher
   */
  async findAll(jwtPayload: JwtPayloadInterface): Promise<ClassEntity[]> {
    return this.classRepo.find({
      where: { teacher_id: jwtPayload.id },
      relations: ['students'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Find a class by ID
   */
  async findOne(id: string, jwtPayload: JwtPayloadInterface): Promise<ClassEntity> {
    const classEntity = await this.classRepo.findOne({
      where: { id },
      relations: ['students', 'teacher'],
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

    return classEntity;
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

    // Update fields
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
   * Add students to a class
   */
  async addStudentsToClass(
    classId: string,
    studentIds: string[],
    jwtPayload: JwtPayloadInterface,
  ): Promise<ClassEntity> {
    const classEntity = await this.findOne(classId, jwtPayload);

    // Validate all students exist and are students
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

    // Get existing student IDs
    const existingStudentIds = classEntity.students?.map((s) => s.id) || [];

    // Filter out duplicates
    const newStudents = students.filter((s) => !existingStudentIds.includes(s.id));

    if (newStudents.length === 0) {
      throw new BadRequestException('All provided students are already in this class');
    }

    // Add new students
    classEntity.students = [...(classEntity.students || []), ...newStudents];

    await this.classRepo.save(classEntity);

    return this.findOne(classId, jwtPayload);
  }

  /**
   * Remove students from a class
   */
  async removeStudentsFromClass(
    classId: string,
    studentIds: string[],
    jwtPayload: JwtPayloadInterface,
  ): Promise<ClassEntity> {
    const classEntity = await this.findOne(classId, jwtPayload);

    // Filter out students to remove
    classEntity.students = classEntity.students?.filter(
      (s) => !studentIds.includes(s.id),
    ) || [];

    await this.classRepo.save(classEntity);

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
   * Get students in a class
   */
  async getClassStudents(classId: string, jwtPayload: JwtPayloadInterface): Promise<UserEntity[]> {
    const classEntity = await this.findOne(classId, jwtPayload);
    return classEntity.students || [];
  }
}

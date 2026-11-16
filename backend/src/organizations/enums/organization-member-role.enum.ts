export enum OrganizationMemberRoleEnum {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  ASSISTANT = 'ASSISTANT',
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
  /** Runs one branch (P12-01, FND-06): refused everywhere except endpoints marked @BranchScoped(). */
  BRANCH_MANAGER = 'BRANCH_MANAGER',
}

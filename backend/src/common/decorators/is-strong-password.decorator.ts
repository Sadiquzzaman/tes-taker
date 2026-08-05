import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { getPasswordComplexityError } from '../utils/password-complexity';

export function IsStrongPassword(
  label = 'Password',
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') {
            return false;
          }
          return getPasswordComplexityError(value, label) === '';
        },
        defaultMessage(args: ValidationArguments) {
          const value = typeof args.value === 'string' ? args.value : '';
          return (
            getPasswordComplexityError(value, label) ||
            `${label} does not meet complexity requirements`
          );
        },
      },
    });
  };
}

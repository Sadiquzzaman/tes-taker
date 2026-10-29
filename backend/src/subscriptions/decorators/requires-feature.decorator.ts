import { SetMetadata } from '@nestjs/common';
import { FeatureKey } from '../constants/feature-catalog';

export const REQUIRED_FEATURE = 'required_feature';

/**
 * The route needs this feature in the workspace's plan (design §8.3, FND-07). Put FeatureGuard
 * after OrganizationContextGuard so the workspace is known:
 *
 *   @UseGuards(AuthGuard('jwt'), RolesGuard, OrganizationContextGuard, FeatureGuard)
 *   @RequiresFeature(FeatureKey.ALLOW_QUESTION_IMPORT_EXPORT)
 *
 * When it is off the request gets 403 with `code: FEATURE_NOT_IN_PLAN`.
 */
export const RequiresFeature = (feature: FeatureKey) => SetMetadata(REQUIRED_FEATURE, feature);

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const PaginationDecorator = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const {
      page = '1',
      limit = '10',
      order = 'updated_at',
      sort = 'DESC',
    } = request.query;

    let pageNo = parseInt(page, 10) || 1;
    pageNo = pageNo < 1 ? 1 : pageNo;

    let limitData = parseInt(limit, 10) || 10;
    limitData = limitData > 50 ? 50 : limitData;

    return {
      page: pageNo,
      limit: limitData,
      order,
      sort: sort.toUpperCase() === 'ASC' ? 'ASC' : 'DESC',
    };
  },
);

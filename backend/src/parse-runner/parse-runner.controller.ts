import { Controller, Post, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ParseRunnerService } from './parse-runner.service';

@Controller('parse-runner')
export class ParseRunnerController {
  constructor(private readonly parseRunnerService: ParseRunnerService) {}

  @Post('parse/:groupId')
  async parseGroup(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Query('force') force?: string,
  ) {
    const forceReparse = force === 'true';
    const result = await this.parseRunnerService.parseGroup(groupId, forceReparse);
    return result;
  }
}

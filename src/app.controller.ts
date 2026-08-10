import { Controller, Get, Header, Version, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Version(VERSION_NEUTRAL)
  @Header('Content-Type', 'text/html')
  @ApiOperation({ summary: 'API Root Landing Page (HTML)' })
  @ApiResponse({ status: 200, description: 'Returns the HTML landing page for BOM ServiceHub API Engine' })
  getLandingRoot(): string {
    return this.appService.getLandingHtml();
  }

  @Get('api')
  @Version(VERSION_NEUTRAL)
  @Header('Content-Type', 'text/html')
  @ApiOperation({ summary: 'API Base Landing Page (HTML)' })
  @ApiResponse({ status: 200, description: 'Returns the HTML landing page for BOM ServiceHub API Engine' })
  getLandingApi(): string {
    return this.appService.getLandingHtml();
  }

  @Get('api/v1')
  @Version(VERSION_NEUTRAL)
  @Header('Content-Type', 'text/html')
  @ApiOperation({ summary: 'API Version 1 Landing Page (HTML)' })
  @ApiResponse({ status: 200, description: 'Returns the HTML landing page for BOM ServiceHub API Engine' })
  getLandingApiV1(): string {
    return this.appService.getLandingHtml();
  }

  @Get('health')
  @ApiOperation({ summary: 'Check API server health status (JSON)' })
  @ApiResponse({ status: 200, description: 'Returns system uptime, database status, and health metrics' })
  getHealthStatus() {
    return this.appService.getHealthStatus();
  }
}


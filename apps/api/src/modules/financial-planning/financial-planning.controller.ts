import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { FinancialPlanningService } from './financial-planning.service';
import { LoanService } from './services/loan.service';
import { FeeBreakdownService } from './services/fee-breakdown.service';
import { HostelLivingService } from './services/hostel-living.service';
import { FinancialDashboardService } from './services/financial-dashboard.service';
import { FinancialPlanScenarioService } from './services/financial-plan-scenario.service';
import { LoanCalculatorDto, CompareLoanOffersDto } from './dto/loan.dto';
import { BudgetPlannerDto } from './dto/budget-planner.dto';
import { FeeBreakdownRequestDto } from './dto/fee-breakdown.dto';
import { HostelLivingRequestDto } from './dto/hostel-living.dto';
import { FinancialDashboardRequestDto } from './dto/dashboard.dto';
import { FinancialComparisonRequestDto } from './dto/comparison.dto';
import { Public } from '../../common/decorators/auth.decorators';
import { AccessTokenPayload } from '../auth/services/token.service';

type AuthReq = Request & { user: AccessTokenPayload };

@Controller('financial-planning')
export class FinancialPlanningController {
  constructor(
    private readonly service: FinancialPlanningService,
    private readonly loanService: LoanService,
    private readonly feeBreakdownService: FeeBreakdownService,
    private readonly hostelLivingService: HostelLivingService,
    private readonly dashboardService: FinancialDashboardService,
    private readonly scenarioService: FinancialPlanScenarioService,
  ) {}

  @Post('loan-calculator') @Public()
  calculateLoan(@Body() dto: LoanCalculatorDto) {
    return { success: true, data: this.loanService.calculateLoan(dto) };
  }

  @Post('loan-calculator/compare') @Public()
  compareLoanOffers(@Body() dto: CompareLoanOffersDto) {
    return { success: true, data: this.loanService.compareLoanOffers(dto) };
  }

  @Post('budget-planner') @Public()
  calculateBudget(@Body() dto: BudgetPlannerDto) {
    return { success: true, data: this.service.calculateBudget(dto) };
  }

  @Post('fee-breakdown') @Public()
  getFeeBreakdown(@Body() dto: FeeBreakdownRequestDto) {
    return this.feeBreakdownService.getFeeBreakdown(dto).then(data => ({ success: true, data }));
  }

  @Post('hostel-living') @Public()
  getHostelLiving(@Body() dto: HostelLivingRequestDto) {
    return this.hostelLivingService.getHostelLivingEstimate(dto).then(data => ({ success: true, data }));
  }

  /**
   * Requires authentication (no @Public()) — the dashboard's whole value
   * over the standalone fee-breakdown/hostel-living endpoints is the
   * personalized scholarship-savings + ROI composition, both of which need
   * a real userId. Anonymous visitors get the public fee-breakdown/
   * hostel-living views instead; the frontend shows a sign-in prompt here,
   * mirroring the scholarship detail page's eligibility-checker pattern.
   */
  @Post('dashboard')
  async getDashboard(@Body() dto: FinancialDashboardRequestDto, @Req() req: AuthReq) {
    const data = await this.dashboardService.getDashboard(req.user.sub, dto);
    await this.scenarioService.saveScenario(req.user.sub, 'dashboard', dto as unknown as Record<string, unknown>, {
      totalProgramCost: data.feeBreakdown.totalProgramCost,
      loanAmountNeeded: data.loanAmountNeeded,
      netFinancialBurden: data.netFinancialBurden,
      collegeId: data.collegeId,
      courseId: data.courseId,
    });
    return { success: true, data };
  }

  /** Same auth-required rationale as the dashboard route — the comparison's
   * scholarship/ROI columns need a real userId. */
  @Post('comparison')
  async getComparison(@Body() dto: FinancialComparisonRequestDto, @Req() req: AuthReq) {
    const data = await this.dashboardService.getComparison(req.user.sub, dto);
    await this.scenarioService.saveScenario(req.user.sub, 'comparison', dto as unknown as Record<string, unknown>, {
      collegeCount: data.rows.length,
      lowestTotalCost: data.rows.length ? Math.min(...data.rows.map(r => r.totalCost)) : 0,
    });
    return { success: true, data };
  }

  /** Financial Planner Memory — "Previous Calculations" for the signed-in student. */
  @Get('history')
  async getHistory(@Req() req: AuthReq) {
    const data = await this.scenarioService.listHistory(req.user.sub);
    return { success: true, data };
  }
}

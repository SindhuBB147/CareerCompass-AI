import { Injectable } from '@nestjs/common';
import { LoanCalculatorDto } from './dto/loan.dto';
import { BudgetPlannerDto } from './dto/budget-planner.dto';
import { LoanService } from './services/loan.service';

export interface BudgetBreakdown {
  totalAnnualCost: number;
  total4YearCost: number;
  monthlyBreakdown: {
    collegeFeeMonthly: number;
    accommodation: number;
    foodAndMess: number;
    transportAndPersonal: number;
    totalMonthly: number;
  };
}

/**
 * Kept as a thin facade during the transition to the richer financial
 * module (LoanService, FeeBreakdownService, etc. — see the other
 * services/ files). calculateLoan() now just delegates to LoanService;
 * calculateBudget() remains here since it's still used as-is elsewhere.
 */
@Injectable()
export class FinancialPlanningService {
  constructor(private readonly loanService: LoanService) {}

  calculateLoan(dto: LoanCalculatorDto) {
    return this.loanService.calculateLoan(dto);
  }

  calculateBudget(dto: BudgetPlannerDto): BudgetBreakdown {
    const cityName = dto.city.toLowerCase();
    
    // Tier-based living estimates for Karnataka college cities
    let accommodationMonthly = 8000;
    let foodMonthly = 4500;
    let transportMonthly = 2500;

    if (cityName.includes('bangalore') || cityName.includes('bengaluru')) {
      accommodationMonthly = 12000;
      foodMonthly = 6000;
      transportMonthly = 3500;
    } else if (cityName.includes('mysore') || cityName.includes('mangalore') || cityName.includes('hubli')) {
      accommodationMonthly = 8500;
      foodMonthly = 5000;
      transportMonthly = 2500;
    }

    const personal = dto.personalSpendingMonthly ?? 2000;
    const collegeFeeMonthly = dto.collegeFeePerYear / 12;
    const totalLivingMonthly = accommodationMonthly + foodMonthly + transportMonthly + personal;
    const totalMonthly = collegeFeeMonthly + totalLivingMonthly;

    const totalAnnualCost = dto.collegeFeePerYear + totalLivingMonthly * 12;

    return {
      totalAnnualCost: Math.round(totalAnnualCost),
      total4YearCost: Math.round(totalAnnualCost * 4),
      monthlyBreakdown: {
        collegeFeeMonthly: Math.round(collegeFeeMonthly),
        accommodation: accommodationMonthly,
        foodAndMess: foodMonthly,
        transportAndPersonal: transportMonthly + personal,
        totalMonthly: Math.round(totalMonthly),
      },
    };
  }
}

export function formatCurrency(amount: number): string {
  if (isNaN(amount) || amount === null) return '₹0';
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)} Cr`;
  }
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)} Lakh`;
  }
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function calculateEmi(principal: number, annualInterestRate: number, tenureYears: number): {
  monthlyEmi: number;
  totalInterest: number;
  totalPayment: number;
} {
  if (principal <= 0 || tenureYears <= 0) {
    return { monthlyEmi: 0, totalInterest: 0, totalPayment: 0 };
  }
  const monthlyRate = annualInterestRate / 12 / 100;
  const totalMonths = tenureYears * 12;
  
  if (monthlyRate === 0) {
    const monthlyEmi = principal / totalMonths;
    return { monthlyEmi, totalInterest: 0, totalPayment: principal };
  }

  const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) / (Math.pow(1 + monthlyRate, totalMonths) - 1);
  const totalPayment = emi * totalMonths;
  const totalInterest = totalPayment - principal;

  return {
    monthlyEmi: Math.round(emi),
    totalInterest: Math.round(totalInterest),
    totalPayment: Math.round(totalPayment),
  };
}

export function rankBucket(rank: number): string {
  if (rank <= 1000) return '1 - 1,000';
  if (rank <= 5000) return '1,001 - 5,000';
  if (rank <= 10000) return '5,001 - 10,000';
  if (rank <= 25000) return '10,001 - 25,000';
  if (rank <= 50000) return '25,001 - 50,000';
  return '50,000+';
}

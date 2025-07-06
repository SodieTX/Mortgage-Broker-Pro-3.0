import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { calculationsAPI, DSCRRequest } from '../services/api';
import { ExclamationTriangleIcon, CheckCircleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

interface DSCRResult {
  dscr: any;
  investment: any;
  summary: any;
}

export default function DSCRCalculator() {
  const [result, setResult] = useState<DSCRResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors }, watch } = useForm<DSCRRequest>({
    defaultValues: {
      property: {
        monthlyRent: 4500,
        vacancyRate: 0.05,
        propertyTaxes: 6000,
        insurance: 1800,
        hoaFees: 200,
        maintenance: 150,
        managementRate: 0.08,
      },
      loanAmount: 400000,
      interestRate: 6.5,
      termMonths: 360,
      purchasePrice: 500000,
      closingCosts: 10000,
    }
  });

  const watchPurchasePrice = watch('purchasePrice');
  const watchLoanAmount = watch('loanAmount');
  const ltv = watchPurchasePrice && watchLoanAmount ? (watchLoanAmount / watchPurchasePrice * 100).toFixed(1) : '0';

  const onSubmit = async (data: DSCRRequest) => {
    setLoading(true);
    setError(null);
    try {
      const response = await calculationsAPI.calculateDSCR(data);
      setResult(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to calculate DSCR');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">DSCR Calculator</h2>
        <p className="mt-1 text-sm text-gray-600">
          Calculate Debt Service Coverage Ratio for investment property loans
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Property Information */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Property Information</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Monthly Rent</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    {...register('property.monthlyRent', { required: true, min: 0 })}
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-7 pr-3 sm:text-sm border-gray-300 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Vacancy Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    {...register('property.vacancyRate', { required: true, min: 0, max: 100 })}
                    className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Management Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    {...register('property.managementRate', { min: 0, max: 100 })}
                    className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Property Taxes (Annual)</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">$</span>
                    </div>
                    <input
                      type="number"
                      {...register('property.propertyTaxes', { required: true, min: 0 })}
                      className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-7 pr-3 sm:text-sm border-gray-300 rounded-md"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Insurance (Annual)</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">$</span>
                    </div>
                    <input
                      type="number"
                      {...register('property.insurance', { required: true, min: 0 })}
                      className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-7 pr-3 sm:text-sm border-gray-300 rounded-md"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">HOA Fees (Monthly)</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">$</span>
                    </div>
                    <input
                      type="number"
                      {...register('property.hoaFees', { min: 0 })}
                      className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-7 pr-3 sm:text-sm border-gray-300 rounded-md"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Maintenance (Monthly)</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">$</span>
                    </div>
                    <input
                      type="number"
                      {...register('property.maintenance', { min: 0 })}
                      className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-7 pr-3 sm:text-sm border-gray-300 rounded-md"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Utilities (Monthly)</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">$</span>
                    </div>
                    <input
                      type="number"
                      {...register('property.utilities', { min: 0 })}
                      className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-7 pr-3 sm:text-sm border-gray-300 rounded-md"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Loan Information */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Loan Information</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Purchase Price</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    {...register('purchasePrice', { required: true, min: 1000 })}
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-7 pr-3 sm:text-sm border-gray-300 rounded-md"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Loan Amount</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    {...register('loanAmount', { required: true, min: 1000 })}
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-7 pr-3 sm:text-sm border-gray-300 rounded-md"
                  />
                </div>
                <p className="mt-1 text-sm text-gray-500">LTV: {ltv}%</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Interest Rate (%)</label>
                  <input
                    type="number"
                    step="0.125"
                    {...register('interestRate', { required: true, min: 0, max: 50 })}
                    className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Loan Term (Months)</label>
                  <input
                    type="number"
                    {...register('termMonths', { required: true, min: 1, max: 480 })}
                    className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Closing Costs</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    {...register('closingCosts', { min: 0 })}
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-7 pr-3 sm:text-sm border-gray-300 rounded-md"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {loading ? 'Calculating...' : 'Calculate DSCR'}
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-6 rounded-md bg-red-50 p-4">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="mt-8 space-y-6">
          {/* DSCR Results */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">DSCR Analysis</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className={`text-3xl font-bold ${result.dscr.dscr >= 1.25 ? 'text-green-600' : 'text-red-600'}`}>
                    {result.dscr.dscr}
                  </div>
                  <div className="text-sm text-gray-500">DSCR</div>
                  {result.dscr.loanApproved ? (
                    <CheckCircleIcon className="h-6 w-6 text-green-500 mx-auto mt-2" />
                  ) : (
                    <ExclamationTriangleIcon className="h-6 w-6 text-red-500 mx-auto mt-2" />
                  )}
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-semibold text-gray-900">
                    {formatCurrency(result.dscr.netOperatingIncome)}
                  </div>
                  <div className="text-sm text-gray-500">Net Operating Income</div>
                </div>
                
                <div className="text-center">
                  <div className={`text-2xl font-semibold ${result.dscr.cashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(result.dscr.cashFlow)}
                  </div>
                  <div className="text-sm text-gray-500">Annual Cash Flow</div>
                </div>
              </div>

              <div className="mt-6 border-t border-gray-200 pt-6">
                <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Gross Rental Income</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatCurrency(result.dscr.details.grossRentalIncome)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Effective Gross Income</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatCurrency(result.dscr.details.effectiveGrossIncome)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Operating Expenses</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatCurrency(result.dscr.details.operatingExpenses)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Annual Debt Service</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatCurrency(result.dscr.details.annualDebtService)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Break-Even Occupancy</dt>
                    <dd className="mt-1 text-sm text-gray-900">{result.dscr.breakEvenOccupancy}%</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Max Qualifying Loan</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatCurrency(result.dscr.maxLoanAmount)}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          {/* Investment Metrics */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Investment Analysis</h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-semibold text-gray-900">{result.investment.capRate}%</div>
                  <div className="text-sm text-gray-500">Cap Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-gray-900">{result.investment.cashOnCashReturn}%</div>
                  <div className="text-sm text-gray-500">Cash-on-Cash</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-gray-900">{formatCurrency(result.investment.monthlyProfit)}</div>
                  <div className="text-sm text-gray-500">Monthly Profit</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-gray-900">{result.investment.breakEvenYears} yrs</div>
                  <div className="text-sm text-gray-500">Break Even</div>
                </div>
              </div>

              <div className="mt-4 rounded-md bg-blue-50 p-4">
                <div className="flex">
                  <InformationCircleIcon className="h-5 w-5 text-blue-400" />
                  <div className="ml-3">
                    <p className="text-sm text-blue-700">
                      Total investment: {formatCurrency(result.investment.metrics.totalInvestment)} | 
                      LTV: {result.investment.metrics.loanToValue}%
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

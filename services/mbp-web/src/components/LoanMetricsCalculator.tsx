import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { calculationsAPI, LoanMetricsRequest } from '../services/api';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function LoanMetricsCalculator() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<LoanMetricsRequest>({
    defaultValues: {
      loanAmount: 350000,
      propertyValue: 450000,
      borrowerIncome: 95000,
      existingMonthlyDebt: 500,
      interestRate: 6.75,
      termMonths: 360,
    }
  });

  const onSubmit = async (data: LoanMetricsRequest) => {
    setLoading(true);
    setError(null);
    try {
      const response = await calculationsAPI.calculateLoanMetrics(data);
      setResult(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to calculate metrics');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Loan Metrics Calculator</h2>
        <p className="mt-1 text-sm text-gray-600">
          Calculate LTV, DTI, and affordability metrics for loan scenarios
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Property Value</label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">$</span>
              </div>
              <input
                type="number"
                {...register('propertyValue', { required: true, min: 1000 })}
                className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-7 pr-3 sm:text-sm border-gray-300 rounded-md"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Annual Income</label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">$</span>
              </div>
              <input
                type="number"
                {...register('borrowerIncome', { required: true, min: 1 })}
                className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-7 pr-3 sm:text-sm border-gray-300 rounded-md"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Monthly Debts</label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">$</span>
              </div>
              <input
                type="number"
                {...register('existingMonthlyDebt', { required: true, min: 0 })}
                className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-7 pr-3 sm:text-sm border-gray-300 rounded-md"
              />
            </div>
          </div>

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

        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {loading ? 'Calculating...' : 'Calculate Metrics'}
        </button>
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
        <div className="mt-8 bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Results</h3>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Loan-to-Value (LTV)</dt>
                <dd className="mt-1 text-2xl font-semibold text-gray-900">{result.loanToValue}%</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Debt-to-Income (DTI)</dt>
                <dd className="mt-1 text-2xl font-semibold text-gray-900">{result.debtToIncome}%</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Monthly Payment</dt>
                <dd className="mt-1 text-2xl font-semibold text-gray-900">
                  ${result.monthlyPayment?.toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Affordability Score</dt>
                <dd className="mt-1 text-2xl font-semibold text-gray-900">{result.affordabilityScore}/100</dd>
              </div>
            </dl>
            {result.recommendations && result.recommendations.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-900">Recommendations</h4>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  {result.recommendations.map((rec: string, idx: number) => (
                    <li key={idx} className="text-sm text-gray-600">{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { calculationsAPI, PaymentRequest } from '../services/api';

export default function PaymentCalculator() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, watch } = useForm<PaymentRequest>({
    defaultValues: {
      principal: 400000,
      annualRate: 6.5,
      termMonths: 360,
    }
  });

  const watchValues = watch();
  
  const onSubmit = async (data: PaymentRequest) => {
    setLoading(true);
    setError(null);
    try {
      const response = await calculationsAPI.calculatePayment(data);
      setResult(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to calculate payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Payment Calculator</h2>
        <p className="mt-1 text-sm text-gray-600">
          Calculate monthly mortgage payments and total interest
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-lg">
        <div>
          <label className="block text-sm font-medium text-gray-700">Loan Amount</label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500 sm:text-sm">$</span>
            </div>
            <input
              type="number"
              {...register('principal', { required: true, min: 1000 })}
              className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-7 pr-3 sm:text-sm border-gray-300 rounded-md"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Interest Rate (%)</label>
          <input
            type="number"
            step="0.125"
            {...register('annualRate', { required: true, min: 0, max: 50 })}
            className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Loan Term</label>
          <select
            {...register('termMonths', { required: true, valueAsNumber: true })}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          >
            <option value={360}>30 Years</option>
            <option value={240}>20 Years</option>
            <option value={180}>15 Years</option>
            <option value={120}>10 Years</option>
            <option value={60}>5 Years</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {loading ? 'Calculating...' : 'Calculate Payment'}
        </button>
      </form>

      {result && (
        <div className="mt-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-gray-900">
                  ${result.monthlyPayment?.toLocaleString()}
                </div>
                <div className="text-sm text-gray-500 mt-1">Monthly Payment</div>
              </div>

              <dl className="mt-8 grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-3">
                <div className="text-center">
                  <dt className="text-sm font-medium text-gray-500">Total Payments</dt>
                  <dd className="mt-1 text-xl font-semibold text-gray-900">
                    ${result.totalPayments?.toLocaleString()}
                  </dd>
                </div>
                <div className="text-center">
                  <dt className="text-sm font-medium text-gray-500">Total Interest</dt>
                  <dd className="mt-1 text-xl font-semibold text-gray-900">
                    ${result.totalInterest?.toLocaleString()}
                  </dd>
                </div>
                <div className="text-center">
                  <dt className="text-sm font-medium text-gray-500">Effective Rate</dt>
                  <dd className="mt-1 text-xl font-semibold text-gray-900">
                    {result.effectiveRate}
                  </dd>
                </div>
              </dl>

              <div className="mt-8">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Payment Breakdown</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Principal</span>
                      <span className="font-medium">${watchValues.principal?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Interest ({watchValues.annualRate}% × {watchValues.termMonths / 12} years)</span>
                      <span className="font-medium">${result.totalInterest?.toLocaleString()}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between text-sm font-medium">
                      <span>Total of all payments</span>
                      <span>${result.totalPayments?.toLocaleString()}</span>
                    </div>
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

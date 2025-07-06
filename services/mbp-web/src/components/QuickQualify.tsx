import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { calculationsAPI, QuickQualifyRequest } from '../services/api';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

export default function QuickQualify() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<QuickQualifyRequest>({
    defaultValues: {
      annualIncome: 120000,
      creditScore: 720,
      downPaymentPercent: 20,
    }
  });

  const onSubmit = async (data: QuickQualifyRequest) => {
    setLoading(true);
    setError(null);
    try {
      const response = await calculationsAPI.quickQualify(data);
      setResult(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to check qualification');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Quick Pre-Qualification</h2>
        <p className="mt-1 text-sm text-gray-600">
          Get instant feedback on loan eligibility and program options
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-lg">
        <div>
          <label className="block text-sm font-medium text-gray-700">Annual Income</label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500 sm:text-sm">$</span>
            </div>
            <input
              type="number"
              {...register('annualIncome', { required: true, min: 1 })}
              className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-7 pr-3 sm:text-sm border-gray-300 rounded-md"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Credit Score</label>
          <input
            type="number"
            {...register('creditScore', { required: true, min: 300, max: 850 })}
            className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Down Payment (%)</label>
          <input
            type="number"
            step="0.5"
            {...register('downPaymentPercent', { required: true, min: 0, max: 100 })}
            className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {loading ? 'Checking...' : 'Check Qualification'}
        </button>
      </form>

      {result && (
        <div className="mt-8">
          <div className={`rounded-lg p-6 ${result.likelyApproved ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className="flex items-center">
              {result.likelyApproved ? (
                <CheckCircleIcon className="h-8 w-8 text-green-400" />
              ) : (
                <XCircleIcon className="h-8 w-8 text-red-400" />
              )}
              <div className="ml-3">
                <h3 className={`text-lg font-medium ${result.likelyApproved ? 'text-green-800' : 'text-red-800'}`}>
                  {result.likelyApproved ? 'Likely to Qualify!' : 'May Face Challenges'}
                </h3>
                <p className={`mt-1 text-sm ${result.likelyApproved ? 'text-green-700' : 'text-red-700'}`}>
                  Estimated max purchase price: ${result.estimatedMaxPurchase?.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {result.recommendedPrograms && result.recommendedPrograms.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-900">Recommended Loan Programs</h4>
              <div className="mt-2 flex flex-wrap gap-2">
                {result.recommendedPrograms.map((program: string, idx: number) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800"
                  >
                    {program}
                  </span>
                ))}
              </div>
            </div>
          )}

          {result.concerns && result.concerns.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-900">Areas of Concern</h4>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                {result.concerns.map((concern: string, idx: number) => (
                  <li key={idx} className="text-sm text-gray-600">{concern}</li>
                ))}
              </ul>
            </div>
          )}

          {result.nextSteps && result.nextSteps.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-900">Next Steps</h4>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                {result.nextSteps.map((step: string, idx: number) => (
                  <li key={idx} className="text-sm text-gray-600">{step}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

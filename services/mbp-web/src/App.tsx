import { useState } from 'react';
import { CalculatorIcon, HomeIcon, ChartBarIcon, DocumentTextIcon, CogIcon } from '@heroicons/react/24/outline';
import DSCRCalculator from './components/DSCRCalculator';
import LoanMetricsCalculator from './components/LoanMetricsCalculator';
import QuickQualify from './components/QuickQualify';
import PaymentCalculator from './components/PaymentCalculator';

type TabType = 'dscr' | 'metrics' | 'qualify' | 'payment';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dscr');

  const tabs = [
    { id: 'dscr' as TabType, name: 'DSCR Calculator', icon: ChartBarIcon },
    { id: 'metrics' as TabType, name: 'Loan Metrics', icon: CalculatorIcon },
    { id: 'qualify' as TabType, name: 'Quick Qualify', icon: HomeIcon },
    { id: 'payment' as TabType, name: 'Payment', icon: DocumentTextIcon },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <CogIcon className="h-8 w-8 text-indigo-600 mr-3" />
              <h1 className="text-xl font-bold text-gray-900">
                Mortgage Broker Pro <span className="text-sm font-normal text-gray-500">v3.0</span>
              </h1>
            </div>
            <div className="text-sm text-gray-500">
              Professional Mortgage Calculations
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm
                    ${activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon
                    className={`
                      -ml-0.5 mr-2 h-5 w-5
                      ${activeTab === tab.id ? 'text-indigo-500' : 'text-gray-400 group-hover:text-gray-500'}
                    `}
                  />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Info Banner */}
        <div className="mb-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-800">
                Professional mortgage calculations powered by real-world business logic. 
                All calculations follow industry standards and lender requirements.
              </p>
            </div>
          </div>
        </div>

        {/* Active Calculator Component */}
        <div className="bg-white rounded-lg shadow-lg">
          {activeTab === 'dscr' && <DSCRCalculator />}
          {activeTab === 'metrics' && <LoanMetricsCalculator />}
          {activeTab === 'qualify' && <QuickQualify />}
          {activeTab === 'payment' && <PaymentCalculator />}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-gray-500">
            © 2025 Mortgage Broker Pro. Built for real mortgage professionals.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App

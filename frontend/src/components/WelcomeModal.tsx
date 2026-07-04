import { useState, type ChangeEvent } from "react";

export interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  buyerName?: string;
}

export function WelcomeModal({ isOpen, onClose, buyerName = "Valued Buyer" }: WelcomeModalProps) {
  const [minBudget, setMinBudget] = useState(100000);
  const [maxBudget, setMaxBudget] = useState(400000);
  const [error, setError] = useState("");

  const [preferences, setPreferences] = useState({
    landType: "",
    intendedUse: "",
    location: "",
    minimumLotSize: "",
  });

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setError("");
    setPreferences({
      ...preferences,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = () => {
    const hasMissingFields = Object.values(preferences).some((value) => !value.trim());

    if (hasMissingFields) {
      setError("Please complete all required preferences before continuing.");
      return;
    }

    if (minBudget > maxBudget) {
      setError("Minimum budget cannot be higher than maximum budget.");
      return;
    }

    console.log({
      minBudget,
      maxBudget,
      ...preferences,
    });
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4 py-8">
      <div className="w-full max-w-[560px] max-h-[calc(100vh-4rem)] overflow-y-auto rounded-2xl bg-gradient-to-br from-[#d9ece6] to-[#76a995] shadow-2xl p-5">
        <h2 className="text-2xl sm:text-3xl font-bold text-[#53463d] mb-1.5">
          Welcome to TerraGuide!
        </h2>

        <p className="text-sm text-gray-700 mb-1.5">
          Hello, {buyerName}! Before you explore, help us find the best properties for you.
        </p>

        <p className="text-sm text-gray-700 mb-5">
          This is required to continue.
        </p>

        <div className="mb-5">
          <label className="block font-semibold text-xs uppercase mb-2">
            Preferred Budget Range (PHP)
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5">
            <div>
              <input
                type="range"
                min="100000"
                max="10000000"
                step="50000"
                value={minBudget}
                onChange={(e) => setMinBudget(Number(e.target.value))}
                className="w-full accent-[#1f5d47]"
              />
              <p className="text-xs mt-1">PHP {minBudget.toLocaleString()}</p>
            </div>

            <div>
              <input
                type="range"
                min="100000"
                max="10000000"
                step="50000"
                value={maxBudget}
                onChange={(e) => setMaxBudget(Number(e.target.value))}
                className="w-full accent-[#1f5d47]"
              />
              <p className="text-xs mt-1 sm:text-right">PHP {maxBudget.toLocaleString()}</p>
            </div>
          </div>

          <p className="text-center mt-1 text-xs text-gray-700">to</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-xs uppercase mb-1.5">
              Land Type Preference
            </label>

            <select
              name="landType"
              value={preferences.landType}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm"
            >
              <option value="">Select an option</option>
              <option>Residential</option>
              <option>Commercial</option>
              <option>Agricultural</option>
              <option>Industrial</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-xs uppercase mb-1.5">
              Intended Use
            </label>

            <select
              name="intendedUse"
              value={preferences.intendedUse}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm"
            >
              <option value="">Select an option</option>
              <option>Primary Residence</option>
              <option>Investment</option>
              <option>Business</option>
              <option>Vacation Home</option>
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className="block font-semibold text-xs uppercase mb-1.5">
            Preferred Location Setting
          </label>

          <select
            name="location"
            value={preferences.location}
            onChange={handleChange}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm"
          >
            <option value="">Select a setting</option>
            <option>Residential Neighborhood</option>
            <option>Suburban Community</option>
            <option>City Center</option>
            <option>Quiet Outskirts</option>
            <option>Rural or Farm Area</option>
            <option>Commercial District</option>
            <option>Near Schools or Workplace</option>
          </select>
        </div>

        <div className="mt-4">
          <label className="block font-semibold text-xs uppercase mb-1.5">
            Minimum Lot Size (SQM)
          </label>

          <input
            type="number"
            name="minimumLotSize"
            min="1"
            placeholder="120"
            value={preferences.minimumLotSize}
            onChange={handleChange}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
          />
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {error}
          </p>
        )}

        <div className="flex justify-end mt-5">
          <button
            onClick={handleSubmit}
            className="bg-[#1d5d48] hover:bg-[#184d3b] text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition"
          >
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}

export default WelcomeModal;

import { useEffect, useState } from 'react';
import { ComparisonContext } from './comparisonContext';

const STORAGE_KEY = 'rentalComparisonVehicles';

export function ComparisonProvider({ children }) {
  const [vehicles, setVehicles] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(vehicles));
  }, [vehicles]);

  const toggleVehicle = (vehicle) => {
    setVehicles((current) => current.some((item) => String(item.id) === String(vehicle.id))
      ? current.filter((item) => String(item.id) !== String(vehicle.id))
      : current.length < 3 ? [...current, vehicle] : current);
  };

  const removeVehicle = (vehicleId) => setVehicles((current) => current.filter((vehicle) => String(vehicle.id) !== String(vehicleId)));
  const clearVehicles = () => setVehicles([]);

  return <ComparisonContext.Provider value={{ vehicles, toggleVehicle, removeVehicle, clearVehicles }}>
    {children}
  </ComparisonContext.Provider>;
}

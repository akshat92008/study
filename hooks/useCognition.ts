import { useState, useCallback } from 'react';

interface CognitionData {
  nodes: any[];
  edges: any[];
  masteryLevels: Record<string, number>;
}

export function useCognition() {
  const [data, setData] = useState<CognitionData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCognitionGraph = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/cognition');
      if (!response.ok) {
        throw new Error('Failed to fetch cognition graph data');
      }
      const json = await response.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { data, isLoading, error, fetchCognitionGraph };
}

'use client';
interface SeededTopic {
  id?: string;
  subject: string;
  chapter: string;
  topic: string;
  microtarget: string;
  order_index?: number;
  status?: string;
}
interface SeededTopicsCardProps {
  topics: SeededTopic[];
}
export function SeededTopicsCard({ topics }: SeededTopicsCardProps) {
  if (!topics?.length) {
    return (
      <section className="rounded-2xl border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Learning Map</h2>
        <p className="mt-2 text-sm text-gray-600">
          Create a goal or upload material to generate your first topic map.
        </p>
      </section>
    );
  }
  const sorted = [...topics].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  const active = sorted.find((topic) => topic.status === 'active') ?? sorted[0];
  const mastered = sorted.filter((topic) => topic.status === 'mastered').length;
  return (
    <section className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Learning Map</h2>
          <p className="mt-1 text-sm text-gray-600">
            {active.chapter} · {mastered}/{sorted.length} topics mastered
          </p>
        </div>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
          {active.subject}
        </span>
      </div>
      <div className="mt-4 rounded-xl bg-gray-50 p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Current microtarget
        </p>
        <h3 className="mt-1 font-semibold text-gray-900">{active.topic}</h3>
        <p className="mt-1 text-sm text-gray-700">{active.microtarget}</p>
      </div>
      <div className="mt-4 space-y-2">
        {sorted.slice(0, 5).map((topic) => (
          <div key={`${topic.topic}-${topic.microtarget}`} className="flex items-start gap-2 text-sm">
            <span className="mt-1 h-2 w-2 rounded-full bg-gray-400" />
            <div>
              <p className="font-medium text-gray-900">{topic.topic}</p>
              <p className="text-gray-600">{topic.microtarget}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

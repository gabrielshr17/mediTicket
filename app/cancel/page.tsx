import Link from "next/link";

export default function CancelPage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-red-600">Payment cancelled</h1>
      <p className="text-gray-600 mt-2">Your appointment was not confirmed. No charge was made.</p>
      <Link href="/" className="mt-6 inline-block rounded-lg bg-brand px-4 py-2 font-semibold text-white">
        Try again
      </Link>
    </main>
  );
}

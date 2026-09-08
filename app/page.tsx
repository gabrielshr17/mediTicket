import BookingForm from "@/components/BookingForm";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">mediTicket</h1>
        <p className="text-gray-600 mt-1">Book a hospital appointment in a few clicks.</p>
      </header>
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <BookingForm />
      </div>
    </main>
  );
}

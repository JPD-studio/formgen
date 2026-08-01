import DocumentEditor from '@/components/DocumentEditor';
import { FormgenProvider } from '@/lib/FormgenStore';

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-100">
      <FormgenProvider>
        <DocumentEditor />
      </FormgenProvider>
    </main>
  );
}

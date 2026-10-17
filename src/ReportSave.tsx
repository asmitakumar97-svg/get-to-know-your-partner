import { useState } from 'react';
import { ArrowDownToLine } from 'lucide-react';

export function ReportSave({ getText, filename = 'same-page-private-reflection.txt' }: { getText: () => string; filename?: string }) {
  const [error, setError] = useState('');
  function download() {
    setError('');
    let url: string | undefined;
    try {
      const text = getText();
      url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.hidden = true;
      document.body.append(link);
      try { link.click(); } finally { link.remove(); }
    } catch (e) {
      setError(`The report could not be saved: ${e instanceof Error ? e.message : 'Please try again in your browser.'}`);
    } finally {
      if (url) { const fileUrl = url; setTimeout(() => URL.revokeObjectURL(fileUrl), 1000); }
    }
  }
  return <>
    <footer className="report-save"><div><h3>A keepsake, just for you two.</h3><p>The download includes private answers and explanations. Save or share it only if you both agree.</p></div><button className="button cream" onClick={download}><ArrowDownToLine size={16} /> Save our report</button></footer>
    {error && <div className="alert error" role="alert">{error}</div>}
  </>;
}

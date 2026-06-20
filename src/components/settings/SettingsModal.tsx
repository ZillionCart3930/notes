import { useRef } from 'react';
import { Download, Upload, Trash2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { exportAll, importAll } from '../../lib/storage';
import { downloadFile, readFileAsText } from '../../lib/utils';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  onAfterImport: () => void;
  onClearAll: () => void;
}

export function SettingsModal({
  open,
  onClose,
  onAfterImport,
  onClearAll,
}: SettingsModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    const json = await exportAll();
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(`notes-${stamp}.json`, json);
  };

  const handleImport = async (file: File) => {
    try {
      const text = await readFileAsText(file);
      const result = await importAll(text);
      alert(
        `Imported ${result.notesAdded} new note${result.notesAdded === 1 ? '' : 's'} and updated ${result.notesUpdated}. ${result.subjectsAdded} new subject${result.subjectsAdded === 1 ? '' : 's'}.`,
      );
      onAfterImport();
      onClose();
    } catch (err) {
      alert(`Import failed: ${(err as Error).message}`);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Settings"
      description="Backup, restore, and data management."
      size="md"
    >
      <div className="flex flex-col gap-3">
        <div className="rounded-apple border border-border bg-surface-2 p-4">
          <h3 className="text-[14px] font-semibold text-text">Backup</h3>
          <p className="mt-1 text-[12.5px] text-text-muted">
            Download all of your notes, subjects, and settings as a single JSON file.
          </p>
          <div className="mt-3">
            <Button
              variant="primary"
              onClick={handleExport}
              leadingIcon={<Download size={14} />}
            >
              Export everything
            </Button>
          </div>
        </div>

        <div className="rounded-apple border border-border bg-surface-2 p-4">
          <h3 className="text-[14px] font-semibold text-text">Restore</h3>
          <p className="mt-1 text-[12.5px] text-text-muted">
            Import a previously exported JSON file. Notes and subjects will be merged
            — anything with a matching ID will be updated.
          </p>
          <div className="mt-3">
            <Button
              variant="secondary"
              onClick={() => fileRef.current?.click()}
              leadingIcon={<Upload size={14} />}
            >
              Choose file…
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleImport(f);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        <div className="rounded-apple border border-danger/30 bg-danger/5 p-4">
          <h3 className="text-[14px] font-semibold text-text">Danger zone</h3>
          <p className="mt-1 text-[12.5px] text-text-muted">
            Delete every note and subject. This cannot be undone.
          </p>
          <div className="mt-3">
            <Button
              variant="danger"
              onClick={() => {
                if (
                  confirm(
                    'Delete ALL notes and subjects? This cannot be undone.',
                  )
                ) {
                  onClearAll();
                  onClose();
                }
              }}
              leadingIcon={<Trash2 size={14} />}
            >
              Delete everything
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

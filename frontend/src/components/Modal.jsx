import * as Dialog from '@radix-ui/react-dialog';
import { X } from '@phosphor-icons/react';
import { useI } from '../i18n.jsx';

/* Kept apart from ui.jsx so the dialog library only loads with the pages that open dialogs. */
export function Modal({ open, onClose, title, description, children }) {
  const { t } = useI();
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="modal" aria-describedby={description ? undefined : undefined}>
          <Dialog.Title asChild><h2>{title}</h2></Dialog.Title>
          {description ? <Dialog.Description className="muted">{description}</Dialog.Description> : null}
          <Dialog.Close asChild><button type="button" className="icon-plain x" aria-label={t('Funga', 'Close')}><X size={18} weight="bold" /></button></Dialog.Close>
          <div style={{ marginTop: 18 }}>{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

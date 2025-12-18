'use client';

import { forwardRef } from 'react';
import {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
} from '../ui/Modal';
import { Button } from '../ui/Button';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
  children?: React.ReactNode;
}

const ConfirmDialog = forwardRef<HTMLDivElement, ConfirmDialogProps>(
  (
    {
      isOpen,
      onClose,
      onConfirm,
      title,
      description,
      confirmText = 'Confirm',
      cancelText = 'Cancel',
      variant = 'danger',
      isLoading = false,
      children,
    },
    ref
  ) => {
    const variantStyles = {
      danger: {
        icon: (
          <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        ),
        buttonVariant: 'danger' as const,
      },
      warning: {
        icon: (
          <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        ),
        buttonVariant: 'primary' as const,
      },
      info: {
        icon: (
          <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        ),
        buttonVariant: 'primary' as const,
      },
    };

    const styles = variantStyles[variant];

    return (
      <Modal
        ref={ref}
        isOpen={isOpen}
        onClose={onClose}
        size="sm"
        showCloseButton={false}
        closeOnEscape={!isLoading}
        closeOnOverlay={!isLoading}
      >
        <ModalBody className="text-center pt-8">
          {styles.icon}
          <ModalTitle className="mb-2">{title}</ModalTitle>
          {description && (
            <ModalDescription>{description}</ModalDescription>
          )}
          {children && (
            <div className="mt-4 text-left">{children}</div>
          )}
        </ModalBody>
        <ModalFooter className="justify-center pb-8">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            variant={styles.buttonVariant}
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmText}
          </Button>
        </ModalFooter>
      </Modal>
    );
  }
);

ConfirmDialog.displayName = 'ConfirmDialog';

export { ConfirmDialog };

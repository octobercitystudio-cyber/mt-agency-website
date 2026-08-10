export const CLIENT_MODAL_APPEARANCE = Object.freeze({
  DEFAULT: 'default',
  PACKAGE_SALE_DARK: 'package-sale-dark',
});

const packageSaleDarkTokens = Object.freeze({
  '--erp-surface': '#120c1a',
  '--erp-surface-raised': '#0b0710',
  '--erp-bg': '#0b0710',
  '--erp-text-main': '#ffffff',
  '--erp-text-default': '#f1e9f8',
  '--erp-text-muted': '#b8a9c7',
  '--erp-border': '#59416d',
  '--erp-primary': '#b57af4',
  '--erp-success': '#7de1b4',
  '--erp-danger': '#ffadb8',
});

export const clientModalAppearance = appearance => appearance === CLIENT_MODAL_APPEARANCE.PACKAGE_SALE_DARK
  ? {
      name: CLIENT_MODAL_APPEARANCE.PACKAGE_SALE_DARK,
      overlayClass: 'erp-client-modal-overlay--package-sale-dark',
      contentClass: 'erp-client-modal-content--package-sale-dark',
      tokens: packageSaleDarkTokens,
    }
  : { name: CLIENT_MODAL_APPEARANCE.DEFAULT, overlayClass: '', contentClass: '', tokens: undefined };

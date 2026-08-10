export const resolveClientModalSaveResult = ({ result, isEditing, draft, payload }) => {
  if (result?.error) return {
    ok: false,
    shouldClose: false,
    message: result.error.message || (isEditing ? 'تعذر تحديث بيانات العميل.' : 'تعذر إنشاء العميل.'),
  };
  return {
    ok: true,
    shouldClose: true,
    savedClient: { ...payload, ...(result?.data || {}), id: result?.data?.id || draft?.id },
  };
};

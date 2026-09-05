import { AppModal } from '@/components/AppModal';

type FormValue = { name: string; barcode: string; carbs: number; protein: number; fat: number };

type Props = {
  open: boolean;
  value: FormValue;
  onChange: (value: FormValue) => void;
  onClose: () => void;
  onSave: () => void;
};

const safeNumber = (value: string | number) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

export function NewFoodModal({ open, value, onChange, onClose, onSave }: Props) {
  return (
    <AppModal open={open} title="Nuovo alimento" eyebrow="DATABASE PERSONALE" onClose={onClose} footer={<div className="modal-actions"><button className="secondary" onClick={onClose}>Annulla</button><button className="primary" onClick={onSave}>Salva alimento</button></div>}>
      <div className="form-grid modal-form">
        <label>Nome<input value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} /></label>
        <label>Barcode<input value={value.barcode} onChange={(e) => onChange({ ...value, barcode: e.target.value })} /></label>
        <label>Carboidrati /100g<input type="number" value={value.carbs} onChange={(e) => onChange({ ...value, carbs: safeNumber(e.target.value) })} /></label>
        <label>Proteine /100g<input type="number" value={value.protein} onChange={(e) => onChange({ ...value, protein: safeNumber(e.target.value) })} /></label>
        <label>Grassi /100g<input type="number" value={value.fat} onChange={(e) => onChange({ ...value, fat: safeNumber(e.target.value) })} /></label>
      </div>
    </AppModal>
  );
}

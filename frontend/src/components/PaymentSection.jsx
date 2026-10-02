import { useRef, useState } from 'react';
import { CalendarDays, CreditCard, ShieldCheck } from 'lucide-react';

export default function PaymentSection({ totalAmount, onConfirm, loading, error }) {
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [validationError, setValidationError] = useState('');
  const expiryPickerRef = useRef(null);
  const expiryMatch = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(expiry);
  const expiryPickerValue = expiryMatch ? `20${expiryMatch[2]}-${expiryMatch[1]}` : '';
  const now = new Date();
  const minimumExpiryMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const formatCardNumber = (value) => value.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ');
  const formatExpiry = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  };

  const openExpiryPicker = () => {
    const picker = expiryPickerRef.current;
    if (!picker) return;
    try {
      if (picker.showPicker) picker.showPicker();
      else picker.focus();
    } catch {
      picker.focus();
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const cardDigits = cardNumber.replace(/\D/g, '');
    if (cardDigits.length !== 16) {
      setValidationError('Enter all 16 digits of your card number.');
      return;
    }
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) {
      setValidationError('Enter the expiry date as MM/YY.');
      return;
    }
    const [month, year] = expiry.split('/').map(Number);
    const expiryMonth = new Date(2000 + year, month - 1, 1);
    const currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    if (expiryMonth < currentMonth) {
      setValidationError('This card has expired.');
      return;
    }
    if (!/^\d{3}$/.test(cvv)) {
      setValidationError('Enter the 3-digit CVV.');
      return;
    }
    setValidationError('');
    onConfirm({ cardNumber: cardDigits, expiry, cvv });
  };

  return (
    <form onSubmit={handleSubmit} style={styles.section}>
      <div style={styles.headerRow}>
        <div style={styles.headerIcon}><CreditCard size={16} /></div>
        <span style={styles.title}>Payment details</span>
      </div>

      <input
        aria-label="Card number"
        inputMode="numeric"
        autoComplete="cc-number"
        placeholder="Card number"
        value={cardNumber}
        onChange={(e) => { setCardNumber(formatCardNumber(e.target.value)); setValidationError(''); }}
        maxLength={19}
        pattern="[0-9 ]{19}"
        aria-invalid={Boolean(validationError && cardNumber.replace(/\D/g, '').length !== 16)}
        style={styles.input}
        required
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div style={styles.expiryField}>
          <input
            aria-label="Expiry date"
            inputMode="numeric"
            autoComplete="cc-exp"
            placeholder="MM/YY"
            value={expiry}
            onChange={(e) => { setExpiry(formatExpiry(e.target.value)); setValidationError(''); }}
            maxLength={5}
            pattern="(0[1-9]|1[0-2])/[0-9]{2}"
            style={{ ...styles.input, ...styles.expiryInput }}
            required
          />
          <button type="button" onClick={openExpiryPicker} aria-label="Choose expiry month" title="Choose expiry month" style={styles.expiryCalendarButton}><CalendarDays size={16} /></button>
          <input
            ref={expiryPickerRef}
            type="month"
            aria-hidden="true"
            tabIndex={-1}
            value={expiryPickerValue}
            min={minimumExpiryMonth}
            onChange={(event) => {
              const [year, month] = event.target.value.split('-');
              if (year && month) setExpiry(`${month}/${year.slice(-2)}`);
              setValidationError('');
            }}
            style={styles.hiddenExpiryPicker}
          />
        </div>
        <input
          aria-label="CVV"
          inputMode="numeric"
          autoComplete="cc-csc"
          placeholder="CVV"
          value={cvv}
          onChange={(e) => { setCvv(e.target.value.replace(/\D/g, '').slice(0, 3)); setValidationError(''); }}
          maxLength={3}
          pattern="[0-9]{3}"
          style={styles.input}
          required
        />
      </div>

      <p style={styles.note}><ShieldCheck size={14} color="#087f8c" /> Demo payment checkout. No card is charged.</p>

      {(validationError || error) && <p role="alert" style={styles.error}>{validationError || error}</p>}

      <button type="submit" disabled={loading} style={styles.button}>
        {loading ? 'Processing payment...' : `Pay ${totalAmount} & confirm`}
      </button>
    </form>
  );
}

const styles = {
  section: {
    width: '100%',
    maxWidth: '500px',
    margin: '16px auto 0',
    background: '#ffffff',
    border: '1px solid #d9e4f2',
    borderRadius: '12px',
    boxShadow: '0 16px 36px rgba(38, 76, 112, 0.12)',
    padding: '16px',
    boxSizing: 'border-box'
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px',
    color: '#172a46',
    fontWeight: '700',
    fontSize: '1.1rem'
  },
  headerIcon: {
    width: '22px',
    height: '22px',
    display: 'grid',
    placeItems: 'center',
    color: '#e89b18',
    background: '#fff7e8',
    borderRadius: '6px'
  },
  title: {
    color: '#172a46',
    fontSize: '1.05rem',
    fontWeight: '700'
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px',
    margin: '8px 0',
    background: '#f8fbff',
    color: '#172a46',
    border: '1px solid #b9cce2',
    borderRadius: '7px'
  },
  expiryField: { position: 'relative' },
  expiryInput: { paddingRight: '34px' },
  expiryCalendarButton: { position: 'absolute', right: '5px', top: '50%', display: 'grid', placeItems: 'center', width: '28px', height: '28px', padding: 0, color: '#718198', background: 'transparent', border: 0, cursor: 'pointer', transform: 'translateY(-50%)' },
  hiddenExpiryPicker: { position: 'absolute', right: '8px', top: '50%', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' },
  note: {
    color: '#718198',
    fontSize: '0.8rem',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  error: {
    color: '#b42345',
    background: '#fff0f2',
    padding: '10px',
    borderRadius: '8px',
    fontSize: '0.9rem'
  },
  button: {
    width: '100%',
    padding: '12px',
    background: '#e89b18',
    color: '#172a46',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginTop: '12px'
  }
};

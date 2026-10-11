import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthShell from '../components/AuthShell';
import FormField from '../components/FormField';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(email, name, password);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Shorten links and track every click."
      footer={<>Already have an account? <Link to="/login" className="font-semibold text-cobalt hover:underline">Sign in</Link></>}
    >
      <form onSubmit={handleSubmit}>
        <FormField id="name" label="Name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
        <FormField id="email" label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <FormField
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />

        {error && (
          <p role="alert" className="mb-4 rounded-lg bg-danger-wash px-3 py-2 text-sm font-medium text-danger">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-cobalt py-3 text-base font-bold text-white transition-colors hover:bg-cobalt-dark disabled:opacity-50"
        >
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>
    </AuthShell>
  );
}

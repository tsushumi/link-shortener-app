import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthShell from '../components/AuthShell';
import FormField from '../components/FormField';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
    // On success the route guard redirects to the dashboard, so no state to reset
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to manage your short links."
      footer={<>New to LinkSnap? <Link to="/register" className="font-semibold text-cobalt hover:underline">Create an account</Link></>}
    >
      <form onSubmit={handleSubmit}>
        <FormField id="email" label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <FormField id="password" label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />

        {error && (
          <p role="alert" className="mb-4 rounded-lg bg-danger-wash px-3 py-2 text-sm font-medium text-danger">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-cobalt py-3 text-base font-bold text-white transition-colors hover:bg-cobalt-dark disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </AuthShell>
  );
}

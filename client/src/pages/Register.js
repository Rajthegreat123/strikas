import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import styled from 'styled-components';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #1a1a1a;
  color: white;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 400px;
  padding: 2rem;
  background: #2a2a2a;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
`;

const Input = styled.input`
  padding: 0.8rem;
  border: 1px solid #444;
  border-radius: 4px;
  background: #333;
  color: white;
  font-size: 1rem;

  &:focus {
    outline: none;
    border-color: #666;
  }
`;

const Button = styled.button`
  padding: 0.8rem;
  background: #4a90e2;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #357abd;
  }
`;

const StyledLink = styled(Link)`
  color: #4a90e2;
  text-decoration: none;
  margin-top: 1rem;

  &:hover {
    text-decoration: underline;
  }
`;

const ErrorMessage = styled.div`
  color: #ff4444;
  margin-bottom: 1rem;
`;

function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      await register(username, email, password);
      navigate('/');
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to register');
    }
  };

  return (
    <Container>
      <Form onSubmit={handleSubmit}>
        <h2>Register for Strikas</h2>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <Input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Input
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        <Button type="submit">Register</Button>
        <StyledLink to="/login">Already have an account? Login</StyledLink>
      </Form>
    </Container>
  );
}

export default Register;

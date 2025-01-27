import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) {
      navigate('/');
    }
  }, [currentUser, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setError('');
      setLoading(true);
      await login(email, password);
      navigate('/');
    } catch (error) {
      console.error('Login error:', error);
      setError('Failed to sign in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container>
      <FormContainer>
        <Title>Login to Strikas</Title>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <Form onSubmit={handleSubmit}>
          <FormGroup>
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </FormGroup>
          <FormGroup>
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </FormGroup>
          <Button type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </Button>
        </Form>
      </FormContainer>
    </Container>
  );
};

const Container = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: #1a1a1a;
`;

const FormContainer = styled.div`
  background: rgba(255, 255, 255, 0.1);
  padding: 2rem;
  border-radius: 8px;
  width: 100%;
  max-width: 400px;
`;

const Title = styled.h1`
  color: #f0f0f0;
  text-align: center;
  margin-bottom: 2rem;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
`;

const Input = styled.input`
  padding: 0.8rem;
  border-radius: 4px;
  border: 1px solid #4a90e2;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 1rem;

  &::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }
`;

const Button = styled.button`
  background: #4a90e2;
  color: white;
  border: none;
  padding: 0.8rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;

  &:hover {
    background: #357abd;
  }

  &:disabled {
    background: #666;
    cursor: not-allowed;
  }
`;

const ErrorMessage = styled.div`
  color: #ff6b6b;
  text-align: center;
  margin-bottom: 1rem;
`;

export default Login;

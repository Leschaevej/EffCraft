'use client';

import { useState, useEffect } from 'react';
import { FaLeaf } from "react-icons/fa";
import "./Contact.scss";

interface FormErrors {
    name: boolean;
    email: boolean;
    message: boolean;
}

export default function Contact() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [errors, setErrors] = useState<FormErrors>({ name: false, email: false, message: false });
    const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    const validate = (): boolean => {
        const newErrors: FormErrors = { name: false, email: false, message: false };
        let isValid = true;

        if (!name.trim() || name.trim().length < 2) {
            newErrors.name = true;
            isValid = false;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email.trim() || !emailRegex.exec(email.trim())) {
            newErrors.email = true;
            isValid = false;
        }

        if (!message.trim() || message.trim().length < 10) {
            newErrors.message = true;
            isValid = false;
        }

        setErrors(newErrors);
        return isValid;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        setStatus('sending');
        setErrorMessage('');

        try {
            const res = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, message }),
            });

            if (res.ok) {
                setStatus('success');
                setName('');
                setEmail('');
                setMessage('');
                setErrors({ name: false, email: false, message: false });
            } else {
                const data = await res.json();
                setErrorMessage(data.error || "Erreur lors de l'envoi");
                setStatus('error');
            }
        } catch {
            setErrorMessage("Erreur de connexion");
            setStatus('error');
        }
    };

    useEffect(() => {
        if (status === 'success' || status === 'error') {
            const timer = setTimeout(() => setStatus('idle'), 4000);
            return () => clearTimeout(timer);
        }
    }, [status]);

    return (
        <form className='contactForm' onSubmit={handleSubmit} noValidate>
            <div>
                <label htmlFor="name">Nom</label>
                <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: false })); }}
                    placeholder="Nom"
                    autoComplete="name"
                    className={errors.name ? 'invalid' : ''}
                    required
                />
                {errors.name && <span className="errorText">Nom requis (2 caractères min.)</span>}
            </div>
            <div>
                <label htmlFor="email">Email</label>
                <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: false })); }}
                    placeholder="Email"
                    autoComplete="email"
                    className={errors.email ? 'invalid' : ''}
                    required
                />
                {errors.email && <span className="errorText">Email invalide</span>}
            </div>
            <div>
                <label htmlFor="message">Message</label>
                <textarea
                    id="message"
                    value={message}
                    onChange={e => { setMessage(e.target.value); setErrors(p => ({ ...p, message: false })); }}
                    placeholder="Message..."
                    autoComplete="off"
                    className={errors.message ? 'invalid' : ''}
                    required
                    rows={7}
                />
                {errors.message && <span className="errorText">Message requis (10 caractères min.)</span>}
            </div>
            <button
                type="submit"
                disabled={status === 'sending'}
                className={status !== 'idle' ? status : ''}
            >
                {status === 'sending'
                    ? 'Envoi en cours...'
                    : status === 'success'
                    ? 'Message envoyé !'
                    : status === 'error'
                    ? errorMessage || 'Erreur, réessayez'
                    : <>Envoyer <FaLeaf /></>
                }
            </button>
        </form>
    );
}

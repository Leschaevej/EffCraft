'use client';

import { useState, FormEvent } from 'react';
import { FaLeaf } from "react-icons/fa";
import "./Contact.scss";

export default function Contact() {
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [message, setMessage] = useState('');

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        console.log({ email, name, message });
    };

    return (
        <form onSubmit={handleSubmit}>
            <div>
                <label htmlFor="name">Nom</label>
                <input
                type="text"
                id="name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Nom"
                required
                />
            </div>
            <div>
                <label htmlFor="email">Email</label>
                <input
                type="email"
                id="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email"
                required
                />
            </div>
            <div>
                <label htmlFor="message">Message</label>
                <textarea
                id="message"
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Message..."
                required
                rows={7}
                />
            </div>
            <button type="submit">
                Envoyer <FaLeaf />
            </button>
        </form>
    );
}
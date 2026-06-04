import React from 'react';
import styles from './Navbar.module.css';

// Simple modern navigation bar with glassmorphism effect
export const Navbar: React.FC = () => {
  return (
    <nav className={styles.navbar}>
      <div className={styles.logo}>CognitionOS</div>
      <ul className={styles.menu}>
        <li><a href="/" className={styles.link}>Home</a></li>
        <li><a href="/about" className={styles.link}>About</a></li>
        <li><a href="/features" className={styles.link}>Features</a></li>
        <li><a href="/contact" className={styles.link}>Contact</a></li>
      </ul>
    </nav>
  );
};

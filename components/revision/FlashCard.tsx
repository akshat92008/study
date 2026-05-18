'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';

interface FlashCardProps {
  front: string;
  back: string;
  onRate: (rating: 'again' | 'hard' | 'good' | 'easy') => void;
}

export default function FlashCard({ front, back, onRate }: FlashCardProps) {
  const [revealed, setRevealed] = useState(false);

  return (
    <Card padding="lg" variant="glow" className="w-full max-w-2xl mx-auto flex flex-col items-center gap-8 min-h-[400px] justify-center">
      <div className="text-xl font-medium text-center">{front}</div>
      
      <AnimatePresence>
        {!revealed ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-8">
            <Button onClick={() => setRevealed(true)} size="lg">Reveal Answer</Button>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="flex flex-col items-center gap-8 w-full mt-4"
          >
            <div className="text-lg text-zinc-300 text-center w-full p-4 border-t border-zinc-800">
              {back}
            </div>
            <div className="flex gap-2 w-full justify-center">
              <Button variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-950/30" onClick={() => { setRevealed(false); onRate('again'); }}>Again</Button>
              <Button variant="ghost" className="text-orange-400 hover:text-orange-300 hover:bg-orange-950/30" onClick={() => { setRevealed(false); onRate('hard'); }}>Hard</Button>
              <Button variant="ghost" className="text-green-400 hover:text-green-300 hover:bg-green-950/30" onClick={() => { setRevealed(false); onRate('good'); }}>Good</Button>
              <Button variant="ghost" className="text-blue-400 hover:text-blue-300 hover:bg-blue-950/30" onClick={() => { setRevealed(false); onRate('easy'); }}>Easy</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

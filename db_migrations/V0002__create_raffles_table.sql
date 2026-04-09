CREATE TABLE t_p67171637_yug_transfer_prize_l.raffles (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  prize VARCHAR(255) NOT NULL,
  prize_icon VARCHAR(100) DEFAULT 'Gift',
  end_date DATE NOT NULL,
  participants INTEGER DEFAULT 0,
  min_amount INTEGER NOT NULL DEFAULT 100,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'ended', 'upcoming')),
  gradient VARCHAR(255) DEFAULT 'from-purple-600 via-pink-500 to-orange-400',
  winner VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);
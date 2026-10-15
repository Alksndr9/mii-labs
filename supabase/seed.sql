-- Начальные данные каталога (ДЗ5). Цены в копейках.
insert into public.meals (id, title, description, goal, calories, meals_per_day, price_per_day, image_url, is_hit, menu) values
  ('balance', 'Баланс', 'Сбалансированный рацион для поддержания формы и энергии в течение дня.', 'balance', 1800, 5, 149000,
   'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800', true,
   array['Овсянка с ягодами', 'Греческий йогурт', 'Курица с булгуром', 'Хумус с овощами', 'Лосось с киноа']),
  ('fit', 'Фит', 'Дефицит калорий без чувства голода: больше белка и клетчатки.', 'weight-loss', 1400, 4, 129000,
   'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800', false,
   array['Омлет со шпинатом', 'Салат с тунцом', 'Индейка с овощами', 'Творог с семенами чиа']),
  ('sport', 'Спорт', 'Профицит калорий и 160 г белка в день для набора мышечной массы.', 'sport', 2600, 6, 189000,
   'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800', false,
   array['Сырники', 'Протеиновый батончик', 'Говядина с рисом', 'Паста с курицей', 'Творожная запеканка', 'Кефир']),
  ('veggie', 'Вега', 'Растительный рацион с полноценным белком из бобовых и тофу.', 'vegetarian', 1700, 5, 139000,
   'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800', false,
   array['Гранола с бананом', 'Смузи', 'Боул с тофу', 'Фалафель с соусом тахини', 'Овощное карри'])
on conflict (id) do update set
  title = excluded.title, description = excluded.description, goal = excluded.goal, calories = excluded.calories,
  meals_per_day = excluded.meals_per_day, price_per_day = excluded.price_per_day, image_url = excluded.image_url,
  is_hit = excluded.is_hit, menu = excluded.menu;

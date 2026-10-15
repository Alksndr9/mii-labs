import { act, render, screen } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DeliveryAddress } from '../types';
import { AddressForm } from './AddressForm';

function createOnSubmit() {
  return vi.fn<(address: DeliveryAddress) => Promise<void>>().mockResolvedValue(undefined);
}

async function fillValidForm(user: UserEvent) {
  await user.type(screen.getByLabelText(/Улица/), 'ул. Ленина');
  await user.type(screen.getByLabelText(/Дом/), '12к1');
  await user.type(screen.getByLabelText(/Телефон/), '8 (900) 123-45-67');
}

describe('AddressForm', () => {
  it('рендерит все поля и кнопку «Сохранить»', () => {
    render(<AddressForm onSubmit={createOnSubmit()} />);

    expect(screen.getByLabelText(/Улица/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Дом/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Квартира/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Телефон/)).toHaveAttribute('type', 'tel');
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeEnabled();
  });

  it('при отправке пустой формы показывает ошибки и фокусирует первое невалидное поле', async () => {
    const user = userEvent.setup();
    const onSubmit = createOnSubmit();
    render(<AddressForm onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Укажите улицу')).toBeInTheDocument();
    expect(screen.getByText('Укажите номер дома')).toBeInTheDocument();
    expect(screen.getByText('Укажите телефон')).toBeInTheDocument();

    const street = screen.getByLabelText(/Улица/);
    expect(street).toHaveFocus();
    expect(street).toHaveAttribute('aria-invalid', 'true');
    expect(street).toHaveAccessibleDescription('Укажите улицу');
    expect(screen.getByLabelText(/Квартира/)).toHaveAttribute('aria-invalid', 'false');
  });

  it('показывает ошибку телефона после ухода из поля и убирает её при исправлении', async () => {
    const user = userEvent.setup();
    render(<AddressForm onSubmit={createOnSubmit()} />);

    const phone = screen.getByLabelText(/Телефон/);
    await user.type(phone, '123');
    expect(screen.queryByText(/Введите российский номер/)).not.toBeInTheDocument();

    await user.tab();
    expect(screen.getByText(/Введите российский номер/)).toBeInTheDocument();

    await user.clear(phone);
    await user.type(phone, '+7 900 123-45-67');
    expect(screen.queryByText(/Введите российский номер/)).not.toBeInTheDocument();
  });

  it('отправляет нормализованный адрес и сообщает об успехе', async () => {
    const user = userEvent.setup();
    const onSubmit = createOnSubmit();
    render(<AddressForm onSubmit={onSubmit} />);

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledWith({
      street: 'ул. Ленина',
      house: '12к1',
      apartment: null,
      phone: '+79001234567',
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Адрес сохранён');
  });

  it('блокирует форму во время сохранения', async () => {
    const user = userEvent.setup();
    let resolveSave: () => void = () => {};
    const onSubmit = vi.fn<(address: DeliveryAddress) => Promise<void>>(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    render(<AddressForm onSubmit={onSubmit} />);

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(screen.getByRole('button', { name: 'Сохраняем…' })).toBeDisabled();
    expect(screen.getByLabelText(/Улица/)).toBeDisabled();

    await act(async () => {
      resolveSave();
    });

    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeEnabled();
    expect(screen.getByRole('status')).toHaveTextContent('Адрес сохранён');
  });

  it('показывает ошибку, если сохранение не удалось, и позволяет повторить', async () => {
    const user = userEvent.setup();
    const onSubmit = createOnSubmit().mockRejectedValueOnce(new Error('network'));
    render(<AddressForm onSubmit={onSubmit} />);

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось сохранить адрес');

    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole('status')).toHaveTextContent('Адрес сохранён');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('подставляет начальные значения', () => {
    render(
      <AddressForm
        initialValues={{ street: 'ул. Мира', house: '5', phone: '+79001234567' }}
        onSubmit={createOnSubmit()}
      />,
    );

    expect(screen.getByLabelText(/Улица/)).toHaveValue('ул. Мира');
    expect(screen.getByLabelText(/Квартира/)).toHaveValue('');
  });
});

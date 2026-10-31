import { createIcon } from './createIcon';

/**
 * `user` — nó `5:1468` do Figma (linha "Edit Profile" de profile-settings).
 *
 * Lá o glifo está numa viewBox de 20; aqui ele foi reduzido a 90% para entrar
 * na mesma grade de 18 dos ícones de campo, mantendo o traço de 2. Sem isso o
 * contorno do nome sairia mais fino que o do e-mail ao lado.
 */
export const UserIcon = createIcon(
  'UserIcon',
  '<path d="M14.2506 15.75V14.24997C14.2506 13.45437 13.93452 12.69126 13.37184 12.12867C12.80916 11.56608 12.04596 11.25 11.25027 11.25H6.74974C5.954 11.25 5.19085 11.56608 4.62818 12.12867C4.06551 12.69126 3.7494 13.45437 3.7494 14.24997V15.75M12.00033 5.25C12.00033 6.90685 10.65708 8.25 9 8.25C7.34296 8.25 5.99966 6.90685 5.99966 5.25C5.99966 3.59314 7.34296 2.25 9 2.25C10.65708 2.25 12.00033 3.59314 12.00033 5.25Z" />',
);

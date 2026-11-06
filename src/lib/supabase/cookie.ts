// La app se abre desde varios hosts (localhost, la IP de la casa, 10.0.2.2) y Supabase arma
// el nombre de la cookie con el host de su URL. Se fija a mano para que el navegador y el
// servidor compartan la misma sesión.
export const AUTH_COOKIE_NAME = "sb-styloapp-auth-token";

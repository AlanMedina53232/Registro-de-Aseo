# 🏫 Sistema de Control de Pagos Escolares - Primaria Aubanel

PWA (Progressive Web App) optimizada para dispositivos móviles y escritorio, diseñada para administrar de forma ágil y transparente la tesorería y el fondo de aseo semanal escolar.

## ✨ Características Principales

* **Matriz de Pagos Semanales:** Control visual e intuitivo del estatus (Pendiente / Pagado / Adelantado) para cada alumno a lo largo del ciclo escolar.
* **Panel Superior de Registro y Reversión:** Permite registrar pagos semanales o adelantados, y corregir o revertir pagos específicos por alumno y semana de manera directa.
* **Control de Excepciones por Hermanos:** Agrupación familiar con soporte para pagos compartidos (un solo pago cubre a los hermanos del grupo).
* **Gestión de Fondo de Aseo:** Configuración de días laborables (lunes a viernes, máx. 5 días a $80/día) y cierre semanal con bloqueo de semanas y registro acumulado en caja.
* **Sincronización en la Nube:** Conectado mediante **Supabase** para persistencia de datos en tiempo real entre múltiples dispositivos (celular y PC).
* **Exportación e Informes:** Opciones para exportar datos en formato CSV, JSON e impresión directa de reportes.

## 🛠️ Tecnologías Utilizadas

* **Frontend:** HTML5, CSS3 (Diseño responsivo y adaptable), JavaScript (Vanilla ES6+).
* **Base de datos y Backend as a Service:** Supabase (PostgreSQL).
* **PWA:** Service Workers y Web App Manifest para funcionamiento offline e instalación como app nativa.

## 🚀 Despliegue (GitHub Pages)

La aplicación está configurada para ejecutarse directamente desde el navegador y puede desplegarse de manera estática en **GitHub Pages**, conectándose de forma segura mediante claves públicas anónimas (`anon key`) a la base de datos en Supabase.
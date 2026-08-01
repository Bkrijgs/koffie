local _ = require("gettext")
return {
    name = "espressolog",
    fullname = _("Espresso log"),
    description = _([[Read-only dashboard van je laatste espresso-shots.

Haalt ze rechtstreeks uit de Supabase REST API (PostgREST) met de anon key en
toont ze fullscreen in een TextViewer. Vers ophalen bij openen, geen auto-poll.]]),
}

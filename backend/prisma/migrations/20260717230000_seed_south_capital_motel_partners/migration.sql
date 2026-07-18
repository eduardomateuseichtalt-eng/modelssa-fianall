-- Move the capital motel fallback records into MotelPartner so administrators
-- can search, edit and disable them like every other partner.
WITH capital_partners (
    "id",
    "name",
    "address",
    "city",
    "phone",
    "priceText",
    "photoUrl",
    "mapUrl",
    "displayOrder",
    "active"
) AS (
    VALUES
        (
            'fallback-curitiba-le-ton',
            'MOTEL LE TON',
            'R. Bento Cego, 251 - Uberaba, Curitiba - PR, 81560-320',
            'Curitiba - PR',
            '(41) 99689-1733',
            NULL,
            NULL,
            'https://www.google.com/maps/search/?api=1&query=Motel%20Le%20Ton%20R.%20Bento%20Cego%2C%20251%20Uberaba%20Curitiba%20PR',
            0,
            true
        ),
        (
            'fallback-curitiba-deslize',
            'MOTEL DESLIZE',
            NULL,
            'Curitiba - PR',
            '(41) 3354-4041',
            NULL,
            NULL,
            'https://www.google.com/maps/search/?api=1&query=Motel%20Deslize%20Curitiba%20PR',
            1,
            true
        ),
        (
            'fallback-florianopolis-2001',
            'MOTEL 2001',
            NULL,
            'Florianopolis - SC',
            '(48) 3258-1098',
            NULL,
            NULL,
            'https://www.google.com/maps/search/?api=1&query=Motel%202001%20Florianopolis%20SC',
            2,
            true
        ),
        (
            'fallback-florianopolis-dallas',
            'MOTEL DALLAS',
            NULL,
            'Florianopolis - SC',
            '(48) 3243-6180',
            NULL,
            NULL,
            'https://www.google.com/maps/search/?api=1&query=Motel%20Dallas%20Florianopolis%20SC',
            3,
            true
        ),
        (
            'fallback-porto-alegre-drops',
            'DROPS MOTEL POA',
            NULL,
            'Porto Alegre - RS',
            '(51) 99865-6241',
            NULL,
            NULL,
            'https://www.google.com/maps/search/?api=1&query=Drops%20Motel%20Porto%20Alegre%20RS',
            4,
            true
        ),
        (
            'fallback-porto-alegre-audace',
            'AUDACE MOTEL',
            NULL,
            'Porto Alegre - RS',
            '(51) 3095-1010',
            NULL,
            NULL,
            'https://www.google.com/maps/search/?api=1&query=Audace%20Motel%20Porto%20Alegre%20RS',
            5,
            true
        )
)
INSERT INTO "MotelPartner" (
    "id",
    "name",
    "address",
    "city",
    "phone",
    "priceText",
    "photoUrl",
    "mapUrl",
    "displayOrder",
    "active",
    "createdAt",
    "updatedAt"
)
SELECT
    capital."id",
    capital."name",
    capital."address",
    capital."city",
    capital."phone",
    capital."priceText",
    capital."photoUrl",
    capital."mapUrl",
    capital."displayOrder",
    capital."active",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM capital_partners AS capital
WHERE NOT EXISTS (
    SELECT 1
    FROM "MotelPartner" AS existing
    WHERE LOWER(TRIM(existing."name")) = LOWER(TRIM(capital."name"))
);

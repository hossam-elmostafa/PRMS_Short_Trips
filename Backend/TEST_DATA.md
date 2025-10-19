# Test Data Documentation

## Employees

### Employee 1
- **ID**: 100325
- **Name**: جمال الدين محمود أحمد السيد
- **Department**: إدارة العلاقات العامة
- **Companions**: 7 (زوجة، 3 أبناء، 3 بنات، أب، أم)

### Employee 2
- **ID**: 100326
- **Name**: أحمد محمد علي
- **Department**: إدارة الموارد البشرية
- **Companions**: 3

### Employee 3
- **ID**: 100327
- **Name**: سارة خالد حسن
- **Department**: إدارة المالية
- **Companions**: 2

## Cities and Hotels

### القاهرة (Cairo)
1. Four Seasons Hotel Cairo at Nile Plaza (c_fs_nile) - Base: 1600 EGP
2. Ramses Hilton Cairo (c_ramses) - Base: 1200 EGP
3. Fairmont Nile City (c_fairmont) - Base: 1400 EGP
4. Marriott Mena House (c_mena) - Base: 1300 EGP
5. Conrad Cairo (c_conrad) - Base: 1350 EGP

### الإسكندرية (Alexandria)
1. Four Seasons Alexandria at San Stefano (a_fs) - Base: 1100 EGP
2. Hilton Alexandria Corniche (a_hilton) - Base: 1000 EGP
3. Steigenberger Cecil (a_steigen) - Base: 950 EGP

### شرم الشيخ (Sharm El Sheikh)
1. Rixos Premium Seagate (s_rixos) - Base: 2000 EGP
2. Baron Resort Sharm El Sheikh (s_baron) - Base: 1800 EGP
3. Savoy Sharm El Sheikh (s_savoy) - Base: 1700 EGP

### الغردقة (Hurghada)
1. Steigenberger Al Dau Beach (h_steigen) - Base: 1500 EGP
2. Jaz Aquamarine (h_jaz) - Base: 1450 EGP
3. Pickalbatros Sea World (h_pick) - Base: 1300 EGP

### الأقصر (Luxor)
1. Sofitel Winter Palace Luxor (l_sofitel) - Base: 1200 EGP
2. Hilton Luxor Resort & Spa (l_hilton) - Base: 1100 EGP

### أسوان (Aswan)
1. Sofitel Legend Old Cataract Aswan (as_old) - Base: 1250 EGP
2. Mövenpick Resort Aswan (as_moven) - Base: 1150 EGP

### سهل حشيش (Sahl Hasheesh)
1. The Oberoi Sahl Hasheesh (sh_oberoi) - Base: 2200 EGP
2. Kempinski Soma Bay (sb_kemp) - Base: 2100 EGP

### منتجعات البحر الأحمر (Red Sea Resorts)
1. Baron Palace Resort (r_baron) - Base: 1600 EGP
2. The Grand Resort (r_grand) - Base: 1400 EGP

## Room Types

| Key | Arabic | Factor |
|-----|--------|--------|
| single | فردي | 1.0 |
| double | مزدوج | 1.4 |
| trible | ثلاثي | 1.7 |
| family_room | غرفة عائلية | 2.0 |
| family_suite | جناح عائلي | 2.6 |
| joiner_suite | جناح ملحق | 2.8 |

## Transport Allowances

- لايوجد (None)
- 300 EGP
- 400 EGP
- 500 EGP
- 600 EGP
- 700 EGP

## Pricing Algorithm

### Room Price Calculation
```
Base Price = Hotel Base Price
Room Factor = Room Type Factor (1.0 - 2.8)
Weekend Multiplier = 1.2 (Friday/Saturday), 1.0 (other days)
Date Fluctuation = (Day of Month % 7) * 40

Final Price = (Base Price * Room Factor * Weekend Multiplier) + Date Fluctuation
```

### Extra Bed Prices
- Four Seasons hotels: 500-700 EGP
- Hilton hotels: 390-400 EGP
- Steigenberger hotels: 380-470 EGP
- Resort hotels: 440-700 EGP

### Trip Total Calculation
```
Total = Sum of (Room Price * Room Count) + Sum of (Extra Bed Price * Extra Bed Count)
Employee Share = Total * 0.60 (60%)
```

## Sample API Calls

### Get Employee Details
```bash
GET /api/employee/100325
```

### Get Hotels by City
```bash
GET /api/hotels/القاهرة
```

### Calculate Room Price
```bash
POST /api/calculate-room-price
{
  "hotelId": "c_fs_nile",
  "date": "2025-10-25",
  "roomTypeKey": "double"
}
```

### Calculate Trip Total
```bash
POST /api/calculate-trip-total
{
  "hotelId": "c_fs_nile",
  "date": "2025-10-25",
  "roomCounts": {
    "double": 2,
    "single": 1
  },
  "extraBedCounts": {
    "double": 1
  }
}
```

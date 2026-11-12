# Kendi HTTP M3U8 kanallarınızı ekleyin

Canlı adres: **https://turis-2027.onrender.com**

## 1. JSON dosyasını açın

Şu dosyayı düzenleyin:

```text
public/custom-channels.json
```

Örnek:

```json
[
  {
    "name": "Benim Kanalım 1",
    "url": "https://ornek.com/canli/yayin.m3u8"
  },
  {
    "name": "Benim Kanalım 2",
    "url": "http://ornek.com/baska-kanal.m3u8"
  }
]
```

Her kanal için `name` ve `url` zorunludur. Bağlantı `http://` veya `https://`
ile başlamalı ve `.m3u8` ile bitmelidir.

## 2. GitHub'a yükleyin

Dosyayı GitHub'daki aynı konuma yükleyin. Ardından Render:

1. **Deploys** bölümünü açın.
2. Otomatik dağıtım başlamazsa **Manual Deploy → Deploy latest commit** seçin.
3. Durum **Live** olana kadar bekleyin.

Bundan sonra her GitHub güncellemesi Render'da yeni bir dağıtım olarak yayınlanır.
Adresiniz değişmez: **https://turis-2027.onrender.com**

## 3. Açılır menüde görünüm

Kanallar bölümündeki açılır menü iki gruba ayrılır:

- **Turis Tv kanalları** — mevcut 37 kanal
- **Özel kanallarım** — JSON dosyanızdaki HTTP kanalları

Özel kanal seçildiğinde playlist ve video parçaları Render proxy'si üzerinden
çalışır. PIN kodu yalnızca bağlantı/indirme bölümü içindir.

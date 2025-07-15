const input = document.getElementById('input');
const group = document.getElementById('group');
const output = document.getElementById('output');
const errorLog = document.getElementById('error-log');
const faqToggle = document.getElementById('faq-toggle');
const faqContent = document.getElementById('faq-content');
const notify = document.getElementById('notify');
const actionButtons = document.getElementById('action-buttons');

// Устанавливаем placeholder для textarea через JS, чтобы избежать проблем с форматированием
input.placeholder = `example.com
104.16.0.0/12
2405:4800::/32
1.2.3.4
sub.google.ru
spotify.com
www.spotify.com`;

// Вспомогательные проверки IP
function validateIPv4(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every(x => /^\d+$/.test(x) && Number(x) >= 0 && Number(x) <= 255);
}

function validateIPv4CIDR(cidr) {
  const [ip, mask] = cidr.split('/');
  return validateIPv4(ip) && +mask >= 0 && +mask <= 32;
}

function validateIPv6CIDR(cidr) {
  const [ip, mask] = cidr.split('/');
  return /^([a-fA-F0-9:]+)$/.test(ip) && +mask >= 0 && +mask <= 128;
}

function isIPv4(ip) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(ip);
}

// Генерация правил
function generateRules(simplify = false) {
  const g = group.value.trim();

  let raw = input.value.trim();

  // Заменяем запятые на переносы строк, не трогаем пробелы
  raw = raw.replace(/,/g, '\n');

  const lines = raw.split('\n').map(x => x.trim()).filter(Boolean);
  const rules = [];
  const suffixes = new Set();
  const errors = [];

  for (const line of lines) {
    if (line.startsWith('#')) continue;
    if (line.includes('/')) {
      if (validateIPv4CIDR(line)) {
        rules.push(`- IP-CIDR,${line},${g}`);
      } else if (validateIPv6CIDR(line)) {
        rules.push(`- IP-CIDR6,${line},${g}`);
      } else {
        rules.push(`# ERROR: ${line}`);
        errors.push(`Некорректный CIDR: ${line}`);
      }
    } else if (isIPv4(line)) {
      if (validateIPv4(line)) {
        rules.push(`- IP-CIDR,${line}/32,${g}`);
      } else {
        rules.push(`# ERROR: ${line}`);
        errors.push(`Некорректный IP: ${line}`);
      }
    } else if (line.startsWith('+.')) {
      suffixes.add(line.slice(2));
    } else if (line.startsWith('.')) {
      suffixes.add(line.slice(1));
    } else if (line.includes('.')) {
      if (simplify) {
        const parts = line.split('.');
        // Упрощаем только если есть поддомен и он не "www"
        if (parts.length > 2 && parts[0].toLowerCase() !== 'www') {
          suffixes.add(parts.slice(-2).join('.'));
        } else {
          rules.push(`- DOMAIN,${line},${g}`);
        }
      } else {
        rules.push(`- DOMAIN,${line},${g}`);
      }
    } else {
      rules.push(`# ERROR: ${line}`);
      errors.push(`Не распознан формат: ${line}`);
    }
  }

  if (simplify) {
    suffixes.forEach(s => rules.unshift(`- DOMAIN-SUFFIX,${s},${g}`));
  }

  rules.push('- MATCH,DIRECT');

  return { yaml: `rules:\n${rules.map(r => '  ' + r).join('\n')}\n`, errors };
}

// Показ уведомлений с цветом (success, error, info)
function showNotify(text, type = 'info') {
  notify.textContent = text;
  notify.style.backgroundColor =
    type === 'success' ? '#28a745' :
    type === 'error' ? '#dc3545' : '#2a2a2a';
  notify.classList.add('show');
  clearTimeout(notify._timeout);
  notify._timeout = setTimeout(() => {
    notify.classList.remove('show');
  }, 2500);
}

// Отобразить результат и ошибки
function showResult(yaml, errors) {
  output.style.display = 'block';
  errorLog.style.display = 'block';
  output.textContent = yaml;
  errorLog.textContent = errors.join('\n');

  // Показываем блок кнопок после генерации
  actionButtons.style.display = 'block';

  if (errors.length) {
    showNotify('Возникла ошибка при генерации конфига', 'error');
  } else {
    showNotify('Конфиг успешно сгенерирован', 'success');
  }
}

function generate() {
  if (!input.value.trim()) {
    showNotify('Пожалуйста, внесите список доменов/IP/CIDR', 'error');
    return;
  }
  const { yaml, errors } = generateRules(false);
  showResult(yaml, errors);
}

function simplify() {
  if (!input.value.trim()) {
    showNotify('Пожалуйста, внесите список доменов/IP/CIDR', 'error');
    return;
  }
  const { yaml, errors } = generateRules(true);
  showResult(yaml, errors);
  showNotify('Конфиг упрощён', 'info');
}

// Копирование с уведомлением
function copyOutput() {
  if (!output.textContent.trim()) {
    showNotify('Нет данных для копирования', 'error');
    return;
  }
  navigator.clipboard.writeText(output.textContent).then(() => {
    showNotify('Настройки скопированы', 'success');
  });
}

// Скачать YAML
function download() {
  if (!output.textContent.trim()) {
    showNotify('Нет данных для скачивания', 'error');
    return;
  }
  const blob = new Blob([output.textContent], { type: 'text/yaml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'clash_rules.yaml';
  a.click();
  URL.revokeObjectURL(url);
}

// FAQ раскрытие с анимацией
function toggleFaq() {
  const expanded = faqToggle.getAttribute('aria-expanded') === 'true';
  if (expanded) {
    faqContent.classList.remove('expanded');
    faqToggle.setAttribute('aria-expanded', 'false');
    faqContent.setAttribute('aria-hidden', 'true');
  } else {
    faqContent.classList.add('expanded');
    faqToggle.setAttribute('aria-expanded', 'true');
    faqContent.setAttribute('aria-hidden', 'false');
  }
}

faqToggle.addEventListener('click', toggleFaq);
faqToggle.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    toggleFaq();
  }
});

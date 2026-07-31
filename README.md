# BizCore — Complete Tax Master Update

## Included
- Multi-record Tax Master with Tax Code, Tax Name, VAT Rate, Effective From, Effective To, Active, Default, Remarks, and document usage count.
- Automatic migration of the previous single VAT setting into the first Tax Master record.
- Only one default tax at a time.
- Default tax must be active and effective today.
- Unique Tax Code validation and effective-date validation.
- Tax records already used by quotations cannot be deleted; they can be made inactive.
- New quotations snapshot Tax Code, Tax Name, VAT Rate, and effective date.
- Existing and historical quotations continue using their saved VAT snapshot.
- Draft quotations retain the controlled Keep/Update prompt when the default VAT changes.

## Run
Open `index.html`, or run `start_server.bat`.

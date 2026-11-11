import javax.xml.XMLConstants;
import javax.xml.transform.stream.StreamSource;
import javax.xml.validation.SchemaFactory;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

/**
 * Waliduje pliki XML FA(3) względem oficjalnego XSD Ministerstwa Finansów (kolejność i typy elementów).
 * Użycie (JDK 11+, potrzebny dostęp do sieci — schemat importuje typy z crd.gov.pl):
 *   curl -o fa3.xsd https://crd.gov.pl/wzor/2025/06/25/13775/schemat.xsd
 *   java -Djavax.xml.accessExternalSchema=all scripts/ksef/ValidateFa3.java fa3.xsd faktura.xml [kolejna.xml ...]
 * Schemat dopuszcza do 50 000 powtórzeń niektórych elementów (maxOccurs), czego parser Xerces z JDK nie potrafi
 * zbudować (brak pamięci), więc w tymczasowej kopii przycinamy takie limity do 10. Struktura, kolejność i typy
 * zostają bez zmian; nie sprawdzamy tylko górnych limitów liczności. Kod wyjścia 0 = wszystkie poprawne.
 */
public class ValidateFa3 {
  public static void main(String[] args) throws Exception {
    String xsd = new String(Files.readAllBytes(new File(args[0]).toPath()), StandardCharsets.UTF_8)
        .replaceAll("maxOccurs=\"[0-9]{3,}\"", "maxOccurs=\"10\"");
    File trimmed = File.createTempFile("fa3-trimmed", ".xsd");
    trimmed.deleteOnExit();
    Files.write(trimmed.toPath(), xsd.getBytes(StandardCharsets.UTF_8));
    var schema = SchemaFactory.newInstance(XMLConstants.W3C_XML_SCHEMA_NS_URI).newSchema(trimmed);
    var validator = schema.newValidator();
    int bad = 0;
    for (int i = 1; i < args.length; i++) {
      try {
        validator.validate(new StreamSource(new File(args[i])));
        System.out.println("OK   " + args[i]);
      } catch (Exception e) {
        bad++;
        System.out.println("BŁĄD " + args[i] + ": " + e.getMessage());
      }
    }
    System.exit(bad == 0 ? 0 : 1);
  }
}

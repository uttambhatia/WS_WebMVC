# WS_WebMVC
WS_WebMVC

Local Transaction - Spring Managed
1. 
   <dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-jdbc</artifactId>
		</dependency>
    
2. 

@Configuration
   @EnableTransactionManagement
   public class Config{
   @Bean
    public PlatformTransactionManager txManager() throws NamingException, SQLException {
		InitialContext init = new InitialContext();
		DataSource ds = (DataSource)init.lookup("jdbc/jcgDS");
		System.out.println("Connecting ----    ------  >>>>  "+ds.getConnection() +" Yo Yo ...---");
        return new DataSourceTransactionManager(ds);
    }
   }
   
 Global Transaction - Atomikos
 
 1. 
  <dependency>
			<groupId>org.springframework</groupId>
			<artifactId>spring-tx</artifactId>
		</dependency>

    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-jta-atomikos</artifactId>
    </dependency>
    
  2. 
  @Configuration
   public class TransactionConfig {

    @Bean(name = "xatx")
    public JtaTransactionManager regTransactionManager () {
      UserTransactionManager userTransactionManager = new UserTransactionManager();
      UserTransaction userTransaction = new UserTransactionImp();
      return new JtaTransactionManager(userTransaction, userTransactionManager);
    }
  }
  
  3. 
  
  @Component
  public class TestFileReader {

    @Autowired
      private GenericWebApplicationContext context;

    @Autowired
    ExtFileReader read;

    public TestFileReader(){
      //System.out.println(read!=null );
      //System.out.println("Hey Hello ---- > >>>>> ::: " + read.getString());
    }

    @PostConstruct
    public void print(){
      System.out.println("Hey Hello ---- > >>>>> ::: " + read.getString());

      JtaTransactionManager txn = (JtaTransactionManager)context.getBean("xatx");
      System.out.println("Hmmmmmm         ------------------------   ::::::::::::  ;;;;;;;;;;;  " + txn);
    }
  }

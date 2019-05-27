package com.cs.demo;

import java.io.IOException;

import javax.xml.transform.Source;

import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.junit4.SpringJUnit4ClassRunner;
import org.springframework.ws.test.server.MockWebServiceClient;
import org.springframework.xml.transform.StringSource;
import static org.springframework.ws.test.server.RequestCreators.withPayload;
import static org.springframework.ws.test.server.ResponseMatchers.*;
//https://memorynotfound.com/spring-ws-server-side-integration-testing/
@RunWith(SpringJUnit4ClassRunner.class)
@SpringBootTest
@ContextConfiguration(classes = ContextCofiguration.class)
public class DemoApplicationTests {

	@Autowired
    private ApplicationContext applicationContext;

    private MockWebServiceClient mockClient;
    
    @Before
    public void init(){
        mockClient = MockWebServiceClient.createClient(applicationContext);
    }

    @Test
    public void valid_xsd_request_response_test() throws IOException {
        Source requestPayload = new StringSource("<getDataSource xmlns=\"http://demo.cs.com/\"/>"
                /*"<ns2:getBeerRequest xmlns:ns2=\"https://memorynotfound.com/beer\">" +
                        "<ns2:id>1</ns2:id>" +
                "</ns2:getBeerRequest>"*/);

        Source responsePayload = new StringSource(
                " <ns2:getDataSourceResponse xmlns:ns2=\"http://demo.cs.com/\">"+
            "<return>"+
                "<datasource>"+
                    "<url>oracle.com</url>"+
                    "<username>uttam</username>"+
                    "<password>123</password>"+
                    "<driverClass>oracle.driver.OracleDriver</driverClass>"+
                "</datasource>"+
            "</return>"+
        "</ns2:getDataSourceResponse>");

        mockClient
                .sendRequest(withPayload(requestPayload))
                .andExpect(noFault())
                .andExpect(payload(responsePayload));/*
                .andExpect(validPayload(xsdSchema))*/;
    }
}
